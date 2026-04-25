//! Bot Orchestrator - Manages multiple trading bots
//!
//! Coordinates bot execution, session tracking, and portfolio management

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tokio::time::{interval, Duration};

use crate::db::Db;
use crate::db::queries;
use crate::db::BotRecord;
use crate::trading::bot_executor::strategies::{Signal, StrategyExecutor, StrategyContext};
use crate::trading::risk_manager::RiskManager;
use crate::trading::bot_loss_tracker::BotLossTrackerManager;
use crate::trading::strategy_coordinator::StrategyCoordinator;
use crate::api::market::fetch_active_markets;
use crate::api::CachedCredentials;
use crate::trading::polymarket::{PolymarketClient, OrderRequest};

/// Event types broadcasted by orchestrator
#[derive(Debug, Clone, serde::Serialize)]
pub enum BotEvent {
    SessionStarted { bot_id: i64, session_id: i64, bot_name: String },
    SessionEnded { bot_id: i64, session_id: i64, final_balance: f64, total_pnl: f64 },
    TradeDecision { bot_id: i64, outcome: String, confidence: f64, bet_size: f64, reason: String },
    OrderExecuted { bot_id: i64, order_id: String },
    BalanceUpdated { bot_id: i64, balance: f64 },
    MarketTransition { new_market_slug: String },
    Error { bot_id: i64, message: String },
}

/// Running bot state
#[derive(Debug, Clone)]
pub struct RunningBot {
    pub bot_id: i64,
    pub session_id: i64,
    pub user_id: i64,  // Store user_id for auto-save
    pub strategy: StrategyExecutor,
    pub last_market_slug: Option<String>,
    pub consecutive_errors: u32,
    pub last_btc_price: Option<f64>,
    pub btc_window_open: Option<f64>,
    pub current_balance: f64,  // Track balance for Kelly calculations
}

/// Bot Orchestrator - manages multiple bots per user
#[derive(Clone)]
pub struct BotOrchestrator {
    db: Db,
    running_bots: Arc<RwLock<HashMap<i64, RunningBot>>>,
    event_sender: mpsc::UnboundedSender<BotEvent>,
    pub auto_save_interval: Duration,
    // Risk management
    pub risk_manager: Arc<RwLock<RiskManager>>,
    pub loss_tracker: Arc<RwLock<BotLossTrackerManager>>,
    pub coordinator: Arc<RwLock<StrategyCoordinator>>,
}

impl BotOrchestrator {
    pub fn new(db: Db, event_sender: mpsc::UnboundedSender<BotEvent>) -> Self {
        Self {
            db,
            running_bots: Arc::new(RwLock::new(HashMap::new())),
            event_sender,
            auto_save_interval: Duration::from_secs(30),
            risk_manager: Arc::new(RwLock::new(RiskManager::new_paper())),
            loss_tracker: Arc::new(RwLock::new(BotLossTrackerManager::new())),
            coordinator: Arc::new(RwLock::new(StrategyCoordinator::default_with_config())),
        }
    }

    /// Calculate bet size using Kelly criterion (from demo project)
    /// Formula: f = (bp - q) / b where:
    /// - b = odds (fractional odds)
    /// - p = probability of winning (confidence)
    /// - q = probability of losing (1 - p)
    ///
    /// For binary markets: odds = 1, so simplified to f = p - q = 2p - 1
    /// Then apply Kelly fraction and max bet limits
    fn calculate_bet_size(
        confidence: f64,
        balance: f64,
        use_kelly: bool,
        kelly_fraction: f64,
        max_bet: f64,
        base_bet_size: f64,
    ) -> f64 {
        if !use_kelly {
            return base_bet_size.min(balance * max_bet);
        }

        let kelly = (2.0 * confidence - 1.0).max(0.0);
        let fractional_kelly = kelly * kelly_fraction;
        let bet_amount = balance * fractional_kelly;
        bet_amount.min(balance * max_bet).max(1.0).min(balance)
    }

    /// Enhanced bet size with odds-aware multipliers (from demo strategy-executor.ts)
    /// Higher odds (60-80 cent): 1.2x (higher win rate, can bet more)
    /// Higher odds (80-95 cent): 0.8x (still high win rate, less upside)
    /// Lower odds (0-40 cent): 0.5x (lottery tickets, bet less)
    fn calculate_bet_size_enhanced(
        confidence: f64,
        balance: f64,
        entry_price: f64,
        use_kelly: bool,
        kelly_fraction: f64,
        max_bet: f64,
        base_bet_size: f64,
        risk_multiplier: f64,
    ) -> f64 {
        if !use_kelly {
            let odds_mult = Self::odds_multiplier(entry_price);
            return (base_bet_size * odds_mult * risk_multiplier).min(balance * max_bet);
        }

        // Kelly with odds-aware multiplier
        let price = if entry_price > 0.0 && entry_price < 1.0 {
            entry_price
        } else {
            0.5
        };
        let b = (1.0 - price) / price;
        let p = confidence;
        let q = 1.0 - p;
        let mut kelly = (b * p - q) / b;
        if kelly <= 0.0 {
            return base_bet_size.min(balance * max_bet);
        }

        // Apply half-Kelly for safety, plus user's fraction, plus odds multiplier
        let odds_mult = Self::odds_multiplier(entry_price);
        let adjusted_kelly = kelly * 0.5 * kelly_fraction * odds_mult * risk_multiplier;
        let kelly_bet = balance * adjusted_kelly;

        let max_bet_amount = balance * max_bet;
        kelly_bet.min(max_bet_amount).max(1.0).min(balance)
    }

    /// Odds-aware multiplier (from demo strategy-executor.ts)
    fn odds_multiplier(price: f64) -> f64 {
        if price >= 0.60 && price <= 0.80 {
            1.2 // Sweet spot
        } else if price > 0.80 {
            0.8 // Expensive
        } else if price < 0.40 {
            0.5 // Cheap / lottery
        } else {
            1.0 // Neutral
        }
    }

    /// Start a bot session
    pub async fn start_bot(
        &self,
        bot: &BotRecord,
        initial_balance: f64,
    ) -> Result<i64, String> {
        // Check if already running
        let running = self.running_bots.read().await;
        if running.contains_key(&bot.id) {
            return Err("Bot is already running".to_string());
        }
        drop(running);

        // Reset portfolio for new session (portfolio must already exist — created by API)
        let portfolio = match queries::get_portfolio(&self.db, bot.id, bot.user_id).await {
            Ok(Some(p)) => p,
            Ok(None) => return Err("Portfolio does not exist — must be created before starting bot".to_string()),
            Err(e) => return Err(format!("Failed to check portfolio: {}", e)),
        };
        queries::reset_portfolio(&self.db, bot.id, initial_balance).await
            .map_err(|e| format!("Failed to reset portfolio: {}", e))?;

        // Create session
        let strategy_config = Some(bot.params.as_str());
        let session_id = queries::create_session(&self.db, bot.id, bot.user_id, initial_balance, strategy_config).await
            .map_err(|e| format!("Failed to create session: {}", e))?;

        // Create strategy executor
        let strategy = StrategyExecutor::new(&bot.strategy_type, &bot.params);

        // Mark bot as running
        queries::update_bot_status(&self.db, bot.id, bot.user_id, "running").await
            .map_err(|e| format!("Failed to update bot status: {}", e))?;

        // Add to running bots with balance tracking
        let running_bot = RunningBot {
            bot_id: bot.id,
            session_id,
            user_id: bot.user_id,
            strategy,
            last_market_slug: None,
            consecutive_errors: 0,
            last_btc_price: None,
            btc_window_open: None,
            current_balance: initial_balance,
        };

        let mut running = self.running_bots.write().await;
        running.insert(bot.id, running_bot);
        drop(running);

        // Broadcast event
        self.event_sender.send(BotEvent::SessionStarted {
            bot_id: bot.id,
            session_id,
            bot_name: bot.name.clone(),
        }).ok();

        tracing::info!("Started bot {} (session {}) with balance {:.2}", bot.id, session_id, initial_balance);

        Ok(session_id)
    }

    /// Stop a bot session
    pub async fn stop_bot(&self, bot_id: i64, user_id: i64) -> Result<(), String> {
        let mut running = self.running_bots.write().await;
        let running_bot = running.remove(&bot_id);

        if let Some(rb) = running_bot {
            // Get final portfolio state
            let portfolio = match queries::get_portfolio(&self.db, bot_id, user_id).await {
                Ok(Some(p)) => p,
                Ok(None) => {
                    tracing::warn!("Bot {} has no portfolio on stop, skipping session end", bot_id);
                    // Still end session with zeroed values
                    let session_id = rb.session_id;
                    queries::end_session(&self.db, session_id, 0.0, 0, 0, 0, 0.0, 0.0).await.ok();
                    queries::update_bot_status(&self.db, bot_id, user_id, "stopped").await.ok();
                    self.event_sender.send(BotEvent::SessionEnded {
                        bot_id,
                        session_id,
                        final_balance: 0.0,
                        total_pnl: 0.0,
                    }).ok();
                    return Ok(());
                },
                Err(e) => return Err(format!("Failed to get portfolio: {}", e)),
            };

            // End session
            queries::end_session(
                &self.db,
                rb.session_id,
                portfolio.balance,
                portfolio.total_trades,
                portfolio.winning_trades,
                portfolio.losing_trades,
                portfolio.total_pnl,
                self.calculate_drawdown(portfolio.balance, portfolio.peak_balance),
            ).await.map_err(|e| format!("Failed to end session: {}", e))?;

            // Update bot status
            queries::update_bot_status(&self.db, bot_id, user_id, "stopped").await
                .map_err(|e| format!("Failed to update bot status: {}", e))?;

            // Broadcast event
            self.event_sender.send(BotEvent::SessionEnded {
                bot_id,
                session_id: rb.session_id,
                final_balance: portfolio.balance,
                total_pnl: portfolio.total_pnl,
            }).ok();

            tracing::info!("Stopped bot {} (session {})", bot_id, rb.session_id);
        }

        Ok(())
    }

    /// Get all running bots for a user
    pub async fn get_running_bots(&self, user_id: i64) -> Vec<i64> {
        let running = self.running_bots.read().await;
        running
            .iter()
            .filter(|(_, rb)| rb.user_id == user_id)
            .map(|(bot_id, _)| *bot_id)
            .collect()
    }

    /// Check if a bot is running
    pub async fn is_running(&self, bot_id: i64) -> bool {
        let running = self.running_bots.read().await;
        running.contains_key(&bot_id)
    }

    /// Execute one cycle for a bot
    /// credential_cache: optional in-memory cache for live order credentials
    pub async fn execute_cycle(
        &self,
        bot_id: i64,
        user_id: i64,
        credential_cache: Option<Arc<RwLock<HashMap<i64, CachedCredentials>>>>,
    ) -> Result<(), String> {
        tracing::debug!("execute_cycle called for bot {} user {}", bot_id, user_id);

        let running = self.running_bots.read().await;
        let running_bot = running.get(&bot_id).cloned();
        drop(running);

        let Some(rb) = running_bot else {
            tracing::warn!("Bot {} not found in running_bots", bot_id);
            return Ok(()); // Bot not running, skip
        };
        tracing::debug!("Bot {} running_bot found, session {}", bot_id, rb.session_id);

        // Get bot config
        let bot = queries::get_bot_by_id(&self.db, bot_id, user_id).await
            .map_err(|e| format!("Failed to get bot: {}", e))?;

        let bot = match bot {
            Some(b) => b,
            None => return Err("Bot not found".to_string()),
        };

        // Get current portfolio for stop-loss/take-profit checks
        let portfolio = match queries::get_portfolio(&self.db, bot_id, user_id).await {
            Ok(Some(p)) => p,
            Ok(None) => {
                tracing::warn!("Bot {} has no portfolio, skipping cycle", bot_id);
                return Ok(());
            },
            Err(e) => return Err(format!("Failed to get portfolio: {}", e)),
        };

        // Update running bot balance
        {
            let mut running = self.running_bots.write().await;
            if let Some(rb) = running.get_mut(&bot_id) {
                rb.current_balance = portfolio.balance;
            }
        }

        // === STOP-LOSS CHECK ===
        // If balance dropped below (initial_balance * (1 - stop_loss)), stop bot
        let stop_loss_threshold = portfolio.initial_balance * (1.0 - bot.stop_loss);
        if portfolio.balance <= stop_loss_threshold {
            tracing::warn!("Bot {} hit stop-loss: balance {:.2} <= threshold {:.2}",
                bot_id, portfolio.balance, stop_loss_threshold);

            // Stop the bot
            self.stop_bot(bot_id, user_id).await?;

            // Update bot stats
            queries::update_bot_stats(&self.db, bot_id, user_id).await.ok();

            self.event_sender.send(BotEvent::Error {
                bot_id,
                message: format!("Stop-loss triggered at {:.2}", portfolio.balance),
            }).ok();

            return Ok(());
        }

        // === TAKE-PROFIT CHECK ===
        // If balance exceeds (initial_balance * (1 + take_profit)), stop bot
        let take_profit_threshold = portfolio.initial_balance * (1.0 + bot.take_profit);
        if portfolio.balance >= take_profit_threshold {
            tracing::info!("Bot {} hit take-profit: balance {:.2} >= threshold {:.2}",
                bot_id, portfolio.balance, take_profit_threshold);

            // Stop the bot
            self.stop_bot(bot_id, user_id).await?;

            // Update bot stats
            queries::update_bot_stats(&self.db, bot_id, user_id).await.ok();

            self.event_sender.send(BotEvent::BalanceUpdated {
                bot_id,
                balance: portfolio.balance,
            }).ok();

            return Ok(());
        }

        // === NORMAL TRADING CYCLE ===
        // Fetch active markets for this bot's asset
        let timeframe = self.extract_timeframe(&bot.market_id);
        let asset = if bot.market_id.contains("btc") {
            "BTC"
        } else if bot.market_id.contains("eth") {
            "ETH"
        } else if bot.market_id.contains("sol") {
            "SOL"
        } else if bot.market_id.contains("xrp") {
            "XRP"
        } else {
            "BTC" // Default
        };
        let all_markets = fetch_active_markets(&timeframe).await;
        let markets: Vec<_> = all_markets.into_iter().filter(|m| m.asset == asset).collect();

        let Some(market) = markets.first().cloned() else {
            tracing::debug!("No active market found, skipping cycle");
            return Ok(());
        };
        tracing::info!("Found market: {} (yes_price={:.3})", market.question, market.yes_price);

        // Get BTC price from Binance
        let btc_price = self.fetch_btc_price().await?;
        tracing::debug!("BTC price: {:.2}", btc_price);

        // Calculate BTC change from last price
        let btc_change = rb.last_btc_price.map(|last| (btc_price - last) / last);
        tracing::debug!("BTC change: {:?}", btc_change);

        // Check if market changed - reset window open price
        let market_slug = format!("btc-updown-5m-{}", market.end_time);
        let btc_window_open = if rb.last_market_slug.as_ref() != Some(&market_slug) {
            // New market, set window open to current BTC price
            tracing::info!("New market detected, setting window open price to {}", btc_price);
            Some(btc_price)
        } else {
            rb.btc_window_open
        };

        // Create strategy context
        let ctx = StrategyContext {
            btc_price,
            btc_change,
            btc_window_open,
            yes_price: market.yes_price,
            no_price: market.no_price,
            time_remaining: market.time_remaining,
        };

        // Execute strategy with full context
        let signal = rb.strategy.evaluate_with_context(ctx);
        tracing::debug!("Signal: {:?}", signal);

        // Update bot state
        {
            let mut running = self.running_bots.write().await;
            if let Some(rb) = running.get_mut(&bot_id) {
                rb.last_btc_price = Some(btc_price);
                rb.btc_window_open = btc_window_open;
                rb.last_market_slug = Some(market_slug);
            }
        }

        // Log decision based on signal
        match signal {
            Signal::Yes(confidence) | Signal::No(confidence) => {
                let outcome = match signal {
                    Signal::Yes(_) => "YES",
                    Signal::No(_) => "NO",
                    _ => "YES",
                };

                // === RISK LAYER: Adjust confidence based on performance ===
                let adjusted_confidence = {
                    let mut tracker = self.loss_tracker.write().await;
                    let conf = tracker.adjust_confidence(bot_id, confidence, rb.current_balance);
                    let risk_mult = tracker.get_risk_multiplier(bot_id, rb.current_balance);
                    drop(tracker);
                    if risk_mult == 0.0 {
                        tracing::warn!("Bot {} blocked by loss tracker risk multiplier", bot_id);
                        return Ok(());
                    }
                    (conf, risk_mult)
                };
                let (adjusted_confidence, risk_mult) = adjusted_confidence;

                // === RISK LAYER: Check if we can open position ===
                let price = if outcome == "YES" { market.yes_price } else { market.no_price };
                {
                    let mut rm = self.risk_manager.write().await;
                    let (allowed, reason) = rm.can_open_position(
                        bot_id,
                        bot.bet_size,
                        adjusted_confidence,
                        rb.current_balance,
                        portfolio.initial_balance,
                    );
                    if !allowed {
                        let reason_str = reason.unwrap_or_else(|| "Risk check failed".to_string());
                        tracing::info!("Bot {} risk check blocked: {}", bot_id, reason_str);
                        return Ok(());
                    }
                }

                // === RISK LAYER: Strategy coordinator check ===
                let market_slug_str = format!("btc-updown-5m-{}", market.end_time);
                let adjusted_bet = if risk_mult < 1.0 {
                    bot.bet_size * risk_mult
                } else {
                    bot.bet_size
                };
                {
                    let mut coord = self.coordinator.write().await;
                    let result = coord.register_decision(
                        &market_slug_str, bot_id, &bot.name, &bot.strategy_type,
                        outcome, adjusted_confidence, adjusted_bet, rb.current_balance,
                    );
                    if !result.allowed {
                        tracing::info!("Bot {} coordinator blocked: {}", bot_id, result.reason);
                        return Ok(());
                    }
                    if let Some(reduced) = result.adjusted_bet_size {
                        tracing::debug!("Bot {} bet reduced to ${:.2}", bot_id, reduced);
                    }
                    if let Some(ref warnings) = result.warnings {
                        for w in warnings {
                            tracing::debug!("Bot {} coordinator warning: {}", bot_id, w);
                        }
                    }
                }

                // Calculate bet size using Kelly with odds-aware multipliers (from demo)
                let bet_size = Self::calculate_bet_size_enhanced(
                    adjusted_confidence,
                    rb.current_balance,
                    price,
                    bot.use_kelly != 0,
                    bot.kelly_fraction,
                    bot.max_bet,
                    bot.bet_size,
                    risk_mult,
                );

                let reason = format!("{:.2} confidence (adjusted: {:.2}) for {}, bet size: {:.2}, risk_mult: {:.2}",
                    confidence, adjusted_confidence, outcome, bet_size, risk_mult);

                // Log the decision
                queries::log_trade_decision(
                    &self.db,
                    bot_id,
                    rb.session_id,
                    user_id,
                    &format!("btc-updown-5m-{}", market.end_time),
                    &market.condition_id,
                    outcome,
                    &bot.strategy_type,
                    confidence,
                    Some(btc_price),
                    btc_change,
                    Some(market.yes_price),
                    Some(market.no_price),
                    Some(market.time_remaining),
                    &reason,
                ).await.map_err(|e| format!("Failed to log decision: {}", e))?;

                // Broadcast decision event with bet size
                self.event_sender.send(BotEvent::TradeDecision {
                    bot_id,
                    outcome: outcome.to_string(),
                    confidence,
                    bet_size,
                    reason,
                }).ok();

                // Execute actual order if in live mode with credentials available
                if bot.trading_mode == "live" {
                    if let Some(ref cred_cache) = credential_cache {
                        let cache = cred_cache.read().await;
                        let creds = cache.get(&user_id).cloned();
                        drop(cache);
                        if let Some(creds) = creds {
                            let mut proceed_with_order = true;
                            
                            // 1. MATIC BALANCE CHECK
                            match crate::trading::polymarket::check_matic_balance(&creds.wallet_address).await {
                                Ok(matic) if matic < 0.01 => {
                                    tracing::warn!("Bot {} has critical MATIC balance: {:.6}", bot_id, matic);
                                    let mut running = self.running_bots.write().await;
                                    if let Some(rb) = running.get_mut(&bot_id) {
                                        rb.consecutive_errors += 1;
                                        if rb.consecutive_errors >= 3 {
                                            drop(running);
                                            tracing::error!("Bot {} stopped due to insufficient MATIC (3 errors)", bot_id);
                                            self.event_sender.send(BotEvent::Error {
                                                bot_id,
                                                message: "Stopped: Insufficient MATIC for gas".to_string(),
                                            }).ok();
                                            let _ = self.stop_bot(bot_id, user_id).await;
                                            return Ok(());
                                        }
                                    }
                                    proceed_with_order = false;
                                }
                                Err(e) => {
                                    tracing::warn!("Bot {} MATIC check failed: {}", bot_id, e);
                                    // Proceed anyway, let place_order fail if it's a real out-of-gas issue
                                }
                                Ok(_) => {} // MATIC is fine
                            }

                            // 2. PLACE ORDER
                            if proceed_with_order {
                                match Self::place_order(
                                    &market,
                                    outcome,
                                    bet_size,
                                    &creds,
                                ).await {
                                    Ok(order_id) => {
                                        tracing::info!("Bot {} order executed: {}", bot_id, order_id);

                                        // Confirm execution with coordinator
                                        {
                                            let mut coord = self.coordinator.write().await;
                                            coord.confirm_execution(
                                                &market_slug_str, bot_id, outcome, bet_size,
                                            );
                                        }

                                        // Mark trade as sent for loss tracker
                                        {
                                            let mut tracker = self.loss_tracker.write().await;
                                            tracker.mark_trade_sent(bot_id);
                                        }
                                        
                                        // Reset consecutive errors on success
                                        let mut running = self.running_bots.write().await;
                                        if let Some(rb) = running.get_mut(&bot_id) {
                                            rb.consecutive_errors = 0;
                                        }
                                        drop(running);

                                        self.event_sender.send(BotEvent::OrderExecuted {
                                            bot_id,
                                            order_id: order_id.clone(),
                                        }).ok();
                                    }
                                    Err(e) => {
                                        tracing::error!("Bot {} order failed: {}", bot_id, e);

                                        // Cancel decision with coordinator
                                        {
                                            let mut coord = self.coordinator.write().await;
                                            coord.cancel_decision(&market_slug_str, bot_id);
                                        }
                                        
                                        let mut running = self.running_bots.write().await;
                                        if let Some(rb) = running.get_mut(&bot_id) {
                                            rb.consecutive_errors += 1;
                                            if rb.consecutive_errors >= 3 {
                                                drop(running);
                                                tracing::error!("Bot {} stopped due to 3 consecutive errors", bot_id);
                                                self.event_sender.send(BotEvent::Error {
                                                    bot_id,
                                                    message: format!("Stopped: 3 consecutive errors: {}", e),
                                                }).ok();
                                                let _ = self.stop_bot(bot_id, user_id).await;
                                            } else {
                                                drop(running);
                                                self.event_sender.send(BotEvent::Error {
                                                    bot_id,
                                                    message: format!("Order failed: {}", e),
                                                }).ok();
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            tracing::warn!("Bot {} in live mode but no credentials for user {}", bot_id, user_id);
                        }
                    } else {
                        tracing::warn!("Bot {} in live mode but no credential cache", bot_id);
                    }
                } else {
                    tracing::debug!("Bot {} paper trading (signal: {} @ {:.2}, bet: {:.2})",
                        bot_id, outcome, confidence, bet_size);
                }
            }
            Signal::Hold(reason) => {
                tracing::info!("Bot {} holding: {}", bot_id, reason);
            }
        }

        Ok(())
    }

    /// Extract timeframe from market_id (e.g., "btc-5" -> "5")
    fn extract_timeframe(&self, market_id: &str) -> String {
        if market_id.contains("-5") {
            "5".to_string()
        } else if market_id.contains("-15") {
            "15".to_string()
        } else if market_id.contains("-60") || market_id.contains("-1h") {
            "60".to_string()
        } else {
            "5".to_string() // Default to 5min
        }
    }

    /// Fetch current BTC price from Binance
    async fn fetch_btc_price(&self) -> Result<f64, String> {
        let client = reqwest::Client::new();
        let resp = client
            .get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| format!("Binance API error: {}", e))?;

        #[derive(serde::Deserialize)]
        struct BinancePrice {
            price: String,
        }

        let data: BinancePrice = resp.json().await
            .map_err(|e| format!("Failed to parse Binance response: {}", e))?;

        data.price.parse::<f64>()
            .map_err(|e| format!("Failed to parse price: {}", e))
    }

    /// Place an order on Polymarket CLOB
    async fn place_order(
        market: &crate::api::market::ActiveMarket,
        outcome: &str,
        bet_size: f64,
        creds: &CachedCredentials,
    ) -> Result<String, String> {
        // Select token based on outcome (YES = UP token, NO = DOWN token)
        let token_id = match outcome {
            "YES" => &market.yes_token_id,
            "NO" => &market.no_token_id,
            _ => return Err(format!("Invalid outcome: {}", outcome)),
        };

        if token_id.is_empty() {
            return Err("Empty token_id".to_string());
        }

        let client = PolymarketClient::from_api_credentials(
            &creds.private_key,
            creds.signature_type,
            Some(crate::trading::polymarket::ApiKeyCreds {
                key: creds.api_key.clone(),
                secret: creds.api_secret.clone(),
                passphrase: creds.api_passphrase.clone(),
            }),
            creds.funder.as_deref(),
        )
        .map_err(|e| format!("Failed to create client: {}", e))?;

        // Get current midpoint price for limit order
        // For a market order, we use a price slightly worse than midpoint to ensure fill
        let current_price = market.yes_price;
        let order_price = if outcome == "YES" {
            // For YES buy, bid slightly above current to get filled
            (current_price * 1.01).min(0.99)
        } else {
            // For NO buy, bid slightly above current to get filled
            ((1.0 - current_price) * 1.01).min(0.99)
        };

        let order = OrderRequest {
            token_id: token_id.clone(),
            price: order_price,
            size: bet_size,
            side: "BUY".to_string(),
        };

        // Create and sign the order
        let signed_order = client.create_order_v2(&order, false)
            .await
            .map_err(|e| format!("Failed to create order: {}", e))?;

        // Post the order to CLOB
        let response = client.post_order(&signed_order)
            .await
            .map_err(|e| format!("Failed to post order: {}", e))?;

        response.order_id
            .or(response.status)
            .ok_or_else(|| "No order ID in response".to_string())
    }

    /// Calculate drawdown from peak
    fn calculate_drawdown(&self, balance: f64, peak: f64) -> f64 {
        if peak > 0.0 {
            (peak - balance) / peak * 100.0
        } else {
            0.0
        }
    }

    /// Auto-save all running sessions
    pub async fn auto_save_sessions(&self) {
        let running = self.running_bots.read().await;

        for (bot_id, rb) in running.iter() {
            // Get current portfolio using stored user_id
            if let Ok(Some(portfolio)) = queries::get_portfolio(&self.db, *bot_id, rb.user_id).await {
                queries::update_running_session(
                    &self.db,
                    rb.session_id,
                    portfolio.total_trades,
                    portfolio.winning_trades,
                    portfolio.losing_trades,
                    portfolio.total_pnl,
                ).await.ok();

                // Also update bot-level stats
                queries::update_bot_stats(&self.db, *bot_id, rb.user_id).await.ok();
            }
        }
    }
}

/// Start the orchestrator loop (runs in background)
pub async fn start_orchestrator_loop(
    orchestrator: Arc<BotOrchestrator>,
    bot_id: i64,
    user_id: i64,
    interval_secs: u64,
    credential_cache: Option<Arc<RwLock<HashMap<i64, CachedCredentials>>>>,
) {
    tracing::info!("Starting orchestrator loop for bot {}", bot_id);

    let mut timer = interval(Duration::from_secs(interval_secs));

    loop {
        timer.tick().await;

        tracing::debug!("Orchestrator loop tick for bot {}", bot_id);

        // Check if bot is still running
        if !orchestrator.is_running(bot_id).await {
            tracing::info!("Bot {} stopped, ending loop", bot_id);
            break;
        }

        // Execute one cycle
        tracing::debug!("Executing cycle for bot {}", bot_id);
        if let Err(e) = orchestrator.execute_cycle(bot_id, user_id, credential_cache.clone()).await {
            tracing::error!("Bot {} cycle error: {}", bot_id, e);
        }
    }
}

/// Start auto-save loop (runs in background)
pub async fn start_auto_save_loop(orchestrator: Arc<BotOrchestrator>) {
    let mut timer = interval(Duration::from_secs(30));

    loop {
        timer.tick().await;
        orchestrator.auto_save_sessions().await;
        tracing::debug!("Auto-saved sessions");
    }
}
