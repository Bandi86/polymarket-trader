//! Bot Orchestrator - Manages multiple trading bots
//!
//! Coordinates bot execution, session tracking, and portfolio management

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{RwLock, mpsc};
use tokio::time::{interval, Duration};

use crate::db::Db;
use crate::db::queries;
use crate::db::BotRecord;
use crate::trading::bot_executor::strategies::{Signal, StrategyExecutor, StrategyContext};
use crate::trading::risk_manager::RiskManager;
use crate::trading::bot_loss_tracker::BotLossTrackerManager;
use crate::trading::competition::CompetitionManager;
use crate::trading::strategy_coordinator::StrategyCoordinator;
use crate::api::market::fetch_active_markets;
use crate::api::CachedCredentials;
use crate::trading::polymarket::{PolymarketClient, ApiKeyCreds, OrderRequest};

#[derive(Debug, Clone, serde::Serialize)]
pub enum BotEvent {
    SessionStarted { bot_id: i64, session_id: i64, bot_name: String },
    SessionEnded {
        bot_id: i64,
        session_id: i64,
        final_balance: f64,
        total_pnl: f64,
        session_trades: i64,
        session_wins: i64,
        session_losses: i64,
        max_drawdown: f64,
    },
    TradeDecision { bot_id: i64, outcome: String, confidence: f64, bet_size: f64, reason: String },
    OrderExecuted { bot_id: i64, order_id: String },
    BalanceUpdated { bot_id: i64, balance: f64 },
    MarketTransition { new_market_slug: String },
    Error { bot_id: i64, message: String },
    Scanning { bot_id: i64, market_slug: String },
    Evaluating { bot_id: i64, strategy: String, confidence: f64 },
    PositionUpdate { bot_id: i64, bot_name: String, side: String, size: f64, price: f64, unrealized_pnl: f64 },
    TradeResult { bot_id: i64, won: bool, pnl: f64 },
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PendingBet {
    pub side: String,
    pub bet_size: f64,
    pub start_price: f64,  // BTC price when bet was placed
    pub end_price: Option<f64>,  // BTC closing price when market ended (used for settlement)
    pub entry_price: f64,
    pub decision_id: i64,
}

#[derive(Debug, Clone)]
pub struct RunningBot {
    pub bot_id: i64,
    pub bot_name: String,
    pub session_id: i64,
    pub user_id: i64,
    pub strategy: StrategyExecutor,
    pub last_market_slug: Option<String>,
    pub consecutive_errors: u32,
    pub last_btc_price: Option<f64>,
    pub btc_window_open: Option<f64>,
    pub current_balance: f64,
    pub pending_bet: Option<PendingBet>,
    pub btc_price_history: Vec<(f64, Instant)>,
    // Session stats tracking
    pub session_trades: i64,
    pub session_wins: i64,
    pub session_losses: i64,
    pub session_pnl: f64,
    pub peak_balance: f64,       // For max_drawdown calculation
    pub max_drawdown: f64,      // Running max drawdown
}

#[derive(Clone)]
pub struct BotOrchestrator {
    db: Db,
    running_bots: Arc<RwLock<HashMap<i64, RunningBot>>>,
    event_sender: mpsc::UnboundedSender<BotEvent>,
    pub auto_save_interval: Duration,
    pub risk_manager: Arc<RwLock<RiskManager>>,
    pub loss_tracker: Arc<RwLock<BotLossTrackerManager>>,
    pub coordinator: Arc<RwLock<StrategyCoordinator>>,
    pub competition_manager: Arc<RwLock<CompetitionManager>>,
}

/// Restore running bots from database on startup
/// This is called once at startup to restore any bots that were running before the server stopped
pub async fn restore_running_bots(orchestrator: Arc<BotOrchestrator>, user_id: i64) {
    tracing::info!("Restoring running bots from database...");

    let running_sessions = match queries::get_all_running_sessions(&orchestrator.db, user_id).await {
        Ok(sessions) => sessions,
        Err(e) => {
            tracing::error!("Failed to fetch running sessions for restore: {}", e);
            return;
        }
    };

    if running_sessions.is_empty() {
        tracing::info!("No running bots to restore");
        return;
    }

    tracing::info!("Found {} running sessions to restore", running_sessions.len());

    let mut restored_bot_ids = std::collections::HashSet::new();
    for session in &running_sessions {
        // Skip if we already restored this bot (bot has multiple running sessions in DB)
        if restored_bot_ids.contains(&session.bot_id) {
            tracing::warn!("Bot {} has multiple running sessions, skipping duplicate session {}", session.bot_id, session.id);
            continue;
        }
        restored_bot_ids.insert(session.bot_id);

        // Get bot config for this session
        let bot = match queries::get_bot_by_id(&orchestrator.db, session.bot_id, session.user_id).await {
            Ok(Some(b)) => b,
            Ok(None) => {
                tracing::warn!("Bot {} not found for session {}, skipping restore", session.bot_id, session.id);
                continue;
            }
            Err(e) => {
                tracing::warn!("Failed to fetch bot {} for restore: {}", session.bot_id, e);
                continue;
            }
        };

        // Recreate strategy executor from bot config
        let strategy = StrategyExecutor::new(&bot.strategy_type, &bot.params);

        // Recreate running bot state
        let running_bot = RunningBot {
            bot_id: bot.id,
            bot_name: bot.name.clone(),
            session_id: session.id,
            user_id: session.user_id,
            strategy,
            last_market_slug: None,
            consecutive_errors: 0,
            last_btc_price: None,
            btc_window_open: None,
            current_balance: session.start_balance,
            pending_bet: None,
            btc_price_history: Vec::new(),
            session_trades: 0,
            session_wins: 0,
            session_losses: 0,
            session_pnl: 0.0,
            peak_balance: session.start_balance,
            max_drawdown: 0.0,
        };

        // Insert into running_bots map
        {
            let mut running = orchestrator.running_bots.write().await;
            running.insert(bot.id, running_bot);
        }

        tracing::info!("Restored bot {} (session {}) with balance {:.2}", bot.id, session.id, session.start_balance);

        // Start the orchestrator loop for this restored bot
        // Copy values needed for the async task (session fields must outlive the await)
        let orchestrator_clone = orchestrator.clone();
        let bot_id = bot.id;
        let session_user_id = session.user_id;
        tokio::spawn(async move {
            start_orchestrator_loop(
                orchestrator_clone,
                bot_id,
                session_user_id,
                5, // 5 second interval
                None,
            ).await;
        });
    }

    tracing::info!("Finished restoring {} running bots", running_sessions.len());
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
            competition_manager: Arc::new(RwLock::new(CompetitionManager::new())),
        }
    }

    /// Initialize and start background loops
    pub fn start_background_loops(&self) {
        let orch = Arc::new(self.clone());
        start_competition_loop(orch);
        tracing::info!("Orchestrator background loops started");
    }

    /// Get count of currently running bots (public for monitoring)
    pub async fn running_count(&self) -> usize {
        let running = self.running_bots.read().await;
        running.len()
    }

    pub async fn resume_bot(&self, bot: &BotRecord, current_balance: f64) -> Result<i64, String> {
        let mut running = self.running_bots.write().await;
        if running.contains_key(&bot.id) { return Ok(0); }
        // NOTE: We deliberately do NOT create a new session here.
        // Sessions are managed by restore_running_bots which uses existing DB sessions.
        // resume_bot only populates the in-memory running_bots map.
        running.insert(bot.id, RunningBot {
            bot_id: bot.id, bot_name: bot.name.clone(), session_id: 0, user_id: bot.user_id, strategy: StrategyExecutor::new(&bot.strategy_type, &bot.params),
            last_market_slug: None, consecutive_errors: 0, last_btc_price: None, btc_window_open: None, current_balance,
            pending_bet: None, btc_price_history: Vec::new(),
            session_trades: 0, session_wins: 0, session_losses: 0, session_pnl: 0.0,
            peak_balance: current_balance, max_drawdown: 0.0,
        });
        Ok(0)
    }

    pub async fn start_bot(&self, bot: &BotRecord, initial_balance: f64) -> Result<i64, String> {
        let running = self.running_bots.read().await;
        if running.contains_key(&bot.id) { return Err("Bot is already running".to_string()); }
        drop(running);
        queries::update_bot_status(&self.db, bot.id, bot.user_id, "running").await.ok();
        let session_id = queries::create_session(&self.db, bot.id, bot.user_id, initial_balance, Some(bot.params.as_str()), &bot.trading_mode).await.map_err(|e| e.to_string())?;
        let mut running = self.running_bots.write().await;
        running.insert(bot.id, RunningBot {
            bot_id: bot.id, bot_name: bot.name.clone(), session_id, user_id: bot.user_id, strategy: StrategyExecutor::new(&bot.strategy_type, &bot.params),
            last_market_slug: None, consecutive_errors: 0, last_btc_price: None, btc_window_open: None,
            current_balance: initial_balance, pending_bet: None, btc_price_history: Vec::new(),
            session_trades: 0, session_wins: 0, session_losses: 0, session_pnl: 0.0,
            peak_balance: initial_balance, max_drawdown: 0.0,
        });
        self.event_sender.send(BotEvent::SessionStarted { bot_id: bot.id, session_id, bot_name: bot.name.clone() }).ok();
        tracing::info!("Bot {} started (session {}), trading_mode={}", bot.id, session_id, bot.trading_mode);
        Ok(session_id)
    }

    pub async fn stop_bot(&self, bot_id: i64, user_id: i64) -> Result<(), String> {
        let mut running = self.running_bots.write().await;
        if let Some(rb) = running.remove(&bot_id) {
            queries::update_bot_status(&self.db, bot_id, user_id, "stopped").await.ok();
            // End session with full stats instead of just marking as stopped
            queries::end_session(
                &self.db,
                rb.session_id,
                rb.current_balance,
                rb.session_trades,
                rb.session_wins,
                rb.session_losses,
                rb.session_pnl,
                rb.max_drawdown,
            ).await.ok();
            self.event_sender.send(BotEvent::SessionEnded {
                bot_id,
                session_id: rb.session_id,
                final_balance: rb.current_balance,
                total_pnl: rb.session_pnl,
                session_trades: rb.session_trades,
                session_wins: rb.session_wins,
                session_losses: rb.session_losses,
                max_drawdown: rb.max_drawdown,
            }).ok();
        } else {
            // Bot not in running_bots map but might still be marked "running" in DB
            // This handles stale DB state after restart or inconsistent stop
            tracing::warn!("Bot {} stop requested but not in running map — cleaning DB status", bot_id);
            queries::update_bot_status(&self.db, bot_id, user_id, "stopped").await.ok();
            // Also end any ghost active session
            if let Ok(Some(session)) = queries::get_active_session(&self.db, bot_id).await {
                queries::end_session(
                    &self.db,
                    session.id,
                    session.start_balance,
                    session.total_trades,
                    session.winning_trades,
                    session.losing_trades,
                    session.total_pnl,
                    session.max_drawdown,
                ).await.ok();
            }
        }
        Ok(())
    }

    pub async fn execute_cycle(&self, bot_id: i64, user_id: i64, credential_cache: Option<Arc<RwLock<HashMap<i64, CachedCredentials>>>>) -> Result<(), String> {
        let running_bot = { let running = self.running_bots.read().await; running.get(&bot_id).cloned() };
        let mut rb = if let Some(b) = running_bot { b } else { 
            eprintln!("[DEBUG] Bot {} not in running_bots map, skipping cycle", bot_id);
            return Ok(()); 
        };

        let bot = queries::get_bot_by_id(&self.db, bot_id, user_id).await.map_err(|e| e.to_string())?.ok_or("Bot not found")?;
        let portfolio = queries::get_portfolio(&self.db, bot_id, user_id).await.map_err(|e| e.to_string())?.ok_or("No portfolio")?;

        eprintln!("[DEBUG] Bot {} cycle: portfolio.balance={}, trading_mode={}", bot_id, portfolio.balance, bot.trading_mode);

        // --- STOP LOSS: stop if balance drops below 50% of initial ---
        if rb.current_balance <= portfolio.initial_balance * 0.5 {
            tracing::warn!("[STOP-LOSS] Bot {} balance {:.2} <= 50% of initial {:.2}, stopping", bot_id, rb.current_balance, portfolio.initial_balance);
            self.stop_bot(bot_id, user_id).await?;
            return Ok(());
        }

        let all_markets = fetch_active_markets("5").await;
        let market = if let Some(m) = all_markets.first() { m.clone() } else { return Ok(()); };
        let btc_price = self.fetch_btc_price().await?;
        
        // Calculate BTC change and velocity/acceleration from price history
        let btc_change;
        let btc_velocity;
        let btc_acceleration;
        {
            let now = Instant::now();
            rb.btc_price_history.push((btc_price, now));
            // Keep only last 30 seconds of history for velocity calc
            let cutoff = now - Duration::from_secs(30);
            rb.btc_price_history.retain(|(_, t)| *t > cutoff);
            
            if rb.btc_price_history.len() >= 2 {
                // Change from oldest in window
                let oldest = rb.btc_price_history.first().map(|(p, _)| *p).unwrap_or(btc_price);
                btc_change = Some((btc_price - oldest) / oldest);
                
                // Velocity: % change per second over window
                let duration_secs = rb.btc_price_history.last().map(|(_, t)| t.elapsed().as_secs_f64()).unwrap_or(1.0).max(1.0);
                btc_velocity = Some(btc_change.unwrap() / duration_secs);
                
                // Acceleration: change in velocity (simplified)
                if rb.btc_price_history.len() >= 3 {
                    let oldest2 = rb.btc_price_history[rb.btc_price_history.len()/2].0;
                    let mid_change = (oldest2 - oldest) / oldest;
                    let mid_duration = duration_secs / 2.0;
                    let prev_velocity = mid_change / mid_duration.max(1.0);
                    btc_acceleration = Some((btc_velocity.unwrap() - prev_velocity) / mid_duration.max(1.0));
                } else {
                    btc_acceleration = Some(0.0);
                }
            } else {
                // Fallback to last_btc_price (velocity = change / 5sec interval assumption)
                btc_change = rb.last_btc_price.map(|last| (btc_price - last) / last);
                btc_velocity = btc_change.map(|c| c / 5.0); // 5 second assumed interval
                btc_acceleration = Some(0.0);
            }
        }
        
        let market_slug = format!("btc-updown-5m-{}", market.end_time);
        
        self.event_sender.send(BotEvent::Scanning { bot_id, market_slug: market_slug.clone() }).ok();

        // Settlement: ONLY on market END (time up) - not on market_changed (which is just a new market starting)
        // The diff is calculated against the CLOSING price (btc_price at settlement time = when market ended)
        // We track end_price in pending_bet so we use the actual closing price, not a mid-market price
        let market_ended = market.time_remaining <= 5;
        
        if market_ended {
            // Market ended - settle the pending bet using CURRENT btc_price as closing price
            if let Some(ref bet) = rb.pending_bet {
                // Use current btc_price as the closing/settlement price
                let settle_price = btc_price;
                let diff = (settle_price - bet.start_price) / bet.start_price;
                
                // Threshold: if diff is very close to 0, treat as loss (no edge case)
                let diff_threshold = 0.0001; // 0.01% threshold
                let won = if diff.abs() < diff_threshold {
                    false // Near-zero diff = loss (house edge)
                } else if bet.side == "YES" {
                    diff > 0.0
                } else {
                    diff < 0.0
                };
                
                // PnL calculation for Polymarket binary options:
                // You spend `bet_size` dollars buying tokens at `entry_price`
                // You get bet_size/entry_price shares
                // If you win: each share pays $1 → payout = bet_size/entry_price
                // Profit = payout - stake = bet_size/entry_price - bet_size
                //        = bet_size * (1.0 - entry_price) / entry_price
                let profit = if won {
                    bet.bet_size * (1.0 - bet.entry_price) / bet.entry_price
                } else {
                    -bet.bet_size
                };
                queries::record_paper_settlement(&self.db, bot_id, bet.decision_id, won, profit, bet.bet_size).await.ok();
                self.event_sender.send(BotEvent::TradeResult { bot_id, won, pnl: profit }).ok();
                eprintln!("[SETTLE] Bot {}: {} won={} profit={:.4} diff={:.6} close={:.2}", bot_id, bet.side, won, profit, diff, settle_price);

                // Update session stats
                rb.session_trades += 1;
                rb.session_pnl += profit;
                if won {
                    rb.session_wins += 1;
                } else {
                    rb.session_losses += 1;
                }

                // Update max_drawdown tracking
                rb.current_balance += profit;
                if rb.current_balance > rb.peak_balance {
                    rb.peak_balance = rb.current_balance;
                }
                let drawdown = (rb.peak_balance - rb.current_balance) / rb.peak_balance;
                if drawdown > rb.max_drawdown {
                    rb.max_drawdown = drawdown;
                }

                rb.pending_bet = None;
            }

            // IMMEDIATE DB SYNC: save current_balance to DB portfolio right after settlement
            // This prevents the 30-second auto-save delay where UI shows wrong balance
            queries::update_portfolio_balance(&self.db, bot_id, rb.current_balance).await.ok();
        }
        
        // Track market slug changes - save closing price when market transitions
        let market_changed = rb.last_market_slug.as_ref() != Some(&market_slug);
        if market_changed {
            // Market transitioned to new one - this means previous market just closed
            // Save the BTC price at transition time as the end_price for any pending bet
            if let Some(ref mut bet) = rb.pending_bet {
                bet.end_price = Some(btc_price);
                eprintln!("[MARKET_TRANSITION] Bot {} save end_price={:.2} for pending bet", bot_id, btc_price);
            }
            rb.btc_window_open = Some(btc_price);
            rb.last_market_slug = Some(market_slug.clone());
            tracing::info!("[MARKET] Bot {} new market: {} (time_remaining={}s)", bot_id, market_slug, market.time_remaining);
        }

        let ctx = StrategyContext {
            btc_price,
            btc_change,
            btc_window_open: rb.btc_window_open,
            yes_price: market.yes_price,
            no_price: market.no_price,
            time_remaining: market.time_remaining * 1000, // Convert seconds to milliseconds
            btc_velocity,
            btc_acceleration,
            btc_volatility: btc_acceleration.map(|a| a.abs()),
        };

        // Javítva: evaluate_with_context használata evaluate_decision helyett
        let signal = rb.strategy.evaluate_with_context(ctx);
        eprintln!("[SIGNAL] Bot {} signal: {:?}", bot_id, signal);

        // Debug logging for signal evaluation
        tracing::debug!(
            "Bot {} cycle: btc_price={}, btc_change={:?}, time_remaining={}, yes_price={}, window_open={:?}, signal={:?}",
            bot_id, btc_price, btc_change, market.time_remaining, market.yes_price, rb.btc_window_open, signal
        );

        // Javítva: Signal enum mintaillesztés és eseményküldés
        if let Signal::Yes(conf) | Signal::No(conf) = signal {
            tracing::info!("Bot {} generated signal: {:?} (confidence: {})", bot_id, signal, conf);

            let outcome = if matches!(signal, Signal::Yes(_)) { "YES" } else { "NO" };
            let price = if outcome == "YES" { market.yes_price } else { market.no_price };

            // ATOMIC: claim trade slot under write lock — prevents duplicate trades from race condition
            let trade_claimed = {
                let mut running = self.running_bots.write().await;
                if let Some(existing) = running.get(&bot_id) {
                    if existing.pending_bet.is_some() {
                        false
                    } else {
                        let pb = PendingBet {
                            side: outcome.to_string(), bet_size: bot.bet_size,
                            start_price: btc_price, end_price: None, entry_price: price, decision_id: 0,
                        };
                        running.get_mut(&bot_id).unwrap().pending_bet = Some(pb.clone());
                        // Also update cloned rb so final save doesn't overwrite
                        rb.pending_bet = Some(pb);
                        true
                    }
                } else {
                    false
                }
            };

            if trade_claimed {
                // --- RISK MANAGER: check if trade is allowed, Kelly-adjusted bet size ---
                let (risk_allowed, risk_reason, actual_bet_size) = {
                    let mut rm = self.risk_manager.write().await;
                    let (can_open, reason) = rm.can_open_position(
                        bot_id, bot.bet_size, conf, rb.current_balance, portfolio.initial_balance,
                    );
                    if !can_open {
                        (false, reason.unwrap_or_default(), bot.bet_size)
                    } else {
                        let (kelly_size, _method) = rm.get_suggested_bet_size(
                            bot_id, conf, price, rb.current_balance,
                        );
                        let size = kelly_size.max(bot.bet_size * 0.25).min(bot.bet_size * 2.0);
                        (true, String::new(), size)
                    }
                };

                if !risk_allowed {
                    tracing::info!("Bot {} trade rejected by risk manager: {}", bot_id, risk_reason);
                    let mut running = self.running_bots.write().await;
                    if let Some(existing) = running.get_mut(&bot_id) {
                        existing.pending_bet = None;
                    }
                } else {
                    self.event_sender.send(BotEvent::TradeDecision { bot_id, outcome: outcome.to_string(), confidence: conf, bet_size: actual_bet_size, reason: "Signal detected".into() }).ok();

                    if bot.trading_mode == "live" {
                        if let Some(ref cache) = credential_cache {
                            let c = cache.read().await;
                            if let Some(creds) = c.get(&user_id) {
                                match Self::place_order(&market, outcome, actual_bet_size, creds).await {
                                    Ok(order_id) => {
                                        tracing::info!("[LIVE] Bot {} order executed: {} ({} @ {})", bot_id, order_id, outcome, price);
                                        let _d_id = queries::log_trade_decision(
                                            &self.db, bot_id, rb.session_id, user_id, &market_slug,
                                            &market.condition_id, outcome, &bot.strategy_type, conf,
                                            Some(btc_price), btc_change, Some(market.yes_price),
                                            Some(market.no_price), Some(market.time_remaining), "live"
                                        ).await.unwrap_or(0);
                                        queries::update_portfolio_balance(&self.db, bot_id, portfolio.balance - actual_bet_size).await.ok();
                                        self.event_sender.send(BotEvent::OrderExecuted { bot_id, order_id }).ok();
                                        self.event_sender.send(BotEvent::PositionUpdate { bot_id, bot_name: rb.bot_name.clone(), side: outcome.to_string(), size: actual_bet_size, price, unrealized_pnl: 0.0 }).ok();
                                    }
                                    Err(e) => {
                                        tracing::error!("[LIVE] Bot {} order failed: {}", bot_id, e);
                                        let mut running = self.running_bots.write().await;
                                        if let Some(existing) = running.get_mut(&bot_id) {
                                            existing.pending_bet = None;
                                        }
                                    }
                                }
                            } else {
                                tracing::warn!("[LIVE] Bot {} no credentials for user_id {}", bot_id, user_id);
                                let mut running = self.running_bots.write().await;
                                if let Some(existing) = running.get_mut(&bot_id) {
                                    existing.pending_bet = None;
                                }
                            }
                        }
                    } else {
                        let d_id = queries::log_trade_decision(&self.db, bot_id, rb.session_id, user_id, &market_slug, &market.condition_id, outcome, &bot.strategy_type, conf, Some(btc_price), btc_change, Some(market.yes_price), Some(market.no_price), Some(market.time_remaining), "paper trade").await.unwrap_or(0);
                        if d_id == 0 {
                            tracing::warn!("Bot {} duplicate trade prevented for market {}", bot_id, market_slug);
                            let mut running = self.running_bots.write().await;
                            if let Some(existing) = running.get_mut(&bot_id) {
                                existing.pending_bet = None;
                            }
                        } else {
                            queries::update_portfolio_balance(&self.db, bot_id, portfolio.balance - actual_bet_size).await.ok();
                            let mut running = self.running_bots.write().await;
                            if let Some(existing) = running.get_mut(&bot_id) {
                                if let Some(ref mut pb) = existing.pending_bet {
                                    pb.decision_id = d_id;
                                    pb.bet_size = actual_bet_size;
                                }
                            }
                            self.event_sender.send(BotEvent::PositionUpdate { bot_id, bot_name: rb.bot_name.clone(), side: outcome.to_string(), size: actual_bet_size, price, unrealized_pnl: 0.0 }).ok();
                        }
                    }
                }
            }
        }

        rb.last_btc_price = Some(btc_price);
        let mut running = self.running_bots.write().await;
        running.insert(bot_id, rb);
        Ok(())
    }

    async fn fetch_btc_price(&self) -> Result<f64, String> {
        let resp = reqwest::get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT").await.map_err(|e| e.to_string())?;
        #[derive(serde::Deserialize)] struct BP { price: String }
        let data: BP = resp.json().await.map_err(|e| e.to_string())?;
        data.price.parse::<f64>().map_err(|e| e.to_string())
    }

    pub async fn fetch_btc_price_public(&self) -> Result<f64, String> {
        self.fetch_btc_price().await
    }

    async fn place_order(market: &crate::api::market::ActiveMarket, outcome: &str, bet_size: f64, creds: &CachedCredentials) -> Result<String, String> {
        // Create PolymarketClient from credentials
        let api_key_creds = ApiKeyCreds {
            key: creds.api_key.clone(),
            secret: creds.api_secret.clone(),
            passphrase: creds.api_passphrase.clone(),
        };

        let client = PolymarketClient::from_api_credentials(
            &creds.private_key,
            creds.signature_type,
            Some(api_key_creds),
            creds.funder.as_deref(),
        ).map_err(|e| format!("Failed to create Polymarket client: {}", e))?;

        // Determine token_id and price based on outcome
        let token_id = if outcome == "YES" {
            market.yes_token_id.clone()
        } else {
            market.no_token_id.clone()
        };

        let price = if outcome == "YES" {
            market.yes_price
        } else {
            market.no_price
        };

        // Build order request - always BUY
        let order_request = OrderRequest {
            token_id,
            price,
            size: bet_size,
            side: "BUY".to_string(),
        };

        // Create and sign the order
        let signed_order = client.create_order_v2(&order_request, false)
            .await
            .map_err(|e| format!("Failed to sign order: {}", e))?;

        // Post the order to the CLOB
        let response = client.post_order(&signed_order)
            .await
            .map_err(|e| format!("Failed to post order: {}", e))?;

        // Return the order_id from the response
        response.order_id.ok_or_else(|| "No order_id in response".to_string())
    }

    pub async fn is_running(&self, bot_id: i64) -> bool { self.running_bots.read().await.contains_key(&bot_id) }
    pub async fn get_all_running_bots(&self) -> Vec<i64> { self.running_bots.read().await.keys().copied().collect() }
    pub async fn get_running_bots(&self, user_id: i64) -> Vec<i64> { self.running_bots.read().await.iter().filter(|(_, b)| b.user_id == user_id).map(|(id, _)| *id).collect() }

    /// Get detailed trading info for a bot (for "why isn't it trading?" status)
    /// Returns a simple info struct (avoids cloning StrategyExecutor)
    pub async fn get_bot_trading_info(&self, bot_id: i64) -> Option<RunningBotInfo> {
        let running = self.running_bots.read().await;
        running.get(&bot_id).map(|rb| RunningBotInfo {
            session_id: rb.session_id,
            current_balance: rb.current_balance,
            session_trades: rb.session_trades,
            session_wins: rb.session_wins,
            session_losses: rb.session_losses,
            session_pnl: rb.session_pnl,
            max_drawdown: rb.max_drawdown,
            pending_bet: rb.pending_bet.clone(),
            last_market_slug: rb.last_market_slug.clone(),
            last_btc_price: rb.last_btc_price,
            consecutive_errors: rb.consecutive_errors,
        })
    }
}

/// Lightweight trading info (avoids cloning StrategyExecutor)
#[derive(Debug, Clone)]
pub struct RunningBotInfo {
    pub session_id: i64,
    pub current_balance: f64,
    pub session_trades: i64,
    pub session_wins: i64,
    pub session_losses: i64,
    pub session_pnl: f64,
    pub max_drawdown: f64,
    pub pending_bet: Option<PendingBet>,
    pub last_market_slug: Option<String>,
    pub last_btc_price: Option<f64>,
    pub consecutive_errors: u32,
}

pub async fn start_orchestrator_loop(orchestrator: Arc<BotOrchestrator>, bot_id: i64, user_id: i64, interval_secs: u64, credential_cache: Option<Arc<RwLock<HashMap<i64, CachedCredentials>>>>) {
    let mut timer = interval(Duration::from_secs(interval_secs));
    loop {
        timer.tick().await;
        if !orchestrator.is_running(bot_id).await { break; }
        let _ = orchestrator.execute_cycle(bot_id, user_id, credential_cache.clone()).await;
    }
}

pub async fn start_auto_save_loop(orchestrator: Arc<BotOrchestrator>) {
    let mut timer = interval(Duration::from_secs(30));
    loop {
        timer.tick().await;
        if let Err(e) = orchestrator.auto_save_sessions().await {
            tracing::error!("[AUTOSAVE] Failed: {}", e);
        }
    }
}
impl BotOrchestrator {
    pub async fn auto_save_sessions(&self) -> Result<(), String> {
        let running = self.running_bots.read().await;
        for (bot_id, bot) in running.iter() {
            if let Err(e) = queries::update_portfolio_balance(&self.db, *bot_id, bot.current_balance).await {
                tracing::warn!("[AUTOSAVE] Failed to save balance for bot {}: {}", bot_id, e);
            }
        }
        Ok(())
    }
}

/// Run competition cycle - called periodically to update competition bots
pub async fn run_competition_cycle(orchestrator: Arc<BotOrchestrator>) {
    let all_markets = fetch_active_markets("5").await;
    let market = if let Some(m) = all_markets.first() { m.clone() } else {
        tracing::warn!("[COMPETITION] No active BTC markets found");
        return;
    };
    let btc_price = match orchestrator.fetch_btc_price().await {
        Ok(p) => p,
        Err(e) => { tracing::warn!("[COMPETITION] Failed to fetch BTC price: {}", e); return; }
    };

    let market_slug = format!("btc-updown-5m-{}", market.end_time);
    tracing::info!("[COMPETITION] Cycle: btc={}, market={}, yes={}, time_rem={}", btc_price, market_slug, market.yes_price, market.time_remaining);

    let mut cm = orchestrator.competition_manager.write().await;
    if !cm.is_active() {
        tracing::debug!("[COMPETITION] Not active, skipping");
        return;
    }

    cm.run_cycle(btc_price, &market_slug, market.yes_price, market.no_price, market.time_remaining);
    drop(cm);

    // Update leaderboard after cycle
    let mut cm = orchestrator.competition_manager.write().await;
    cm.update_leaderboard();
}

/// Start background task for competition cycles
pub fn start_competition_loop(orchestrator: Arc<BotOrchestrator>) {
    let orch = orchestrator.clone();
    tokio::spawn(async move {
        let mut timer = interval(Duration::from_secs(5));
        tracing::info!("[COMPETITION] Loop started, is_active={}", orch.competition_manager.read().await.is_active());
        loop {
            timer.tick().await;
            tracing::debug!("[COMPETITION] Tick");
            run_competition_cycle(orch.clone()).await;
        }
    });
    tracing::info!("Competition loop started");
}

// ==================== Tests ====================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_running_bot_info_fields() {
        let info = RunningBotInfo {
            session_id: 1,
            current_balance: 100.0,
            session_trades: 5,
            session_wins: 3,
            session_losses: 2,
            session_pnl: 15.0,
            max_drawdown: 0.1,
            pending_bet: None,
            last_market_slug: Some("btc-updown-5m-12345".to_string()),
            last_btc_price: Some(78000.0),
            consecutive_errors: 0,
        };
        assert_eq!(info.session_id, 1);
        assert_eq!(info.current_balance, 100.0);
        assert_eq!(info.session_trades, 5);
        assert_eq!(info.session_wins, 3);
        assert_eq!(info.session_losses, 2);
        assert_eq!(info.session_pnl, 15.0);
        assert!(info.pending_bet.is_none());
        assert_eq!(info.consecutive_errors, 0);
    }

    #[test]
    fn test_running_bot_info_with_pending_bet() {
        let bet = PendingBet {
            side: "YES".to_string(),
            bet_size: 10.0,
            start_price: 77900.0,
            end_price: None,
            entry_price: 0.55,
            decision_id: 42,
        };
        let info = RunningBotInfo {
            session_id: 2,
            current_balance: 90.0,
            session_trades: 1,
            session_wins: 0,
            session_losses: 0,
            session_pnl: -10.0,
            max_drawdown: 0.1,
            pending_bet: Some(bet.clone()),
            last_market_slug: None,
            last_btc_price: None,
            consecutive_errors: 0,
        };
        assert_eq!(info.session_trades, 1);
        assert_eq!(info.session_pnl, -10.0);
        assert!(info.pending_bet.is_some());
        let pb = info.pending_bet.unwrap();
        assert_eq!(pb.side, "YES");
        assert_eq!(pb.bet_size, 10.0);
        assert_eq!(pb.start_price, 77900.0);
        assert_eq!(pb.entry_price, 0.55);
        assert_eq!(pb.decision_id, 42);
        assert!(pb.end_price.is_none());
    }

    #[test]
    fn test_pending_bet_clone() {
        let bet = PendingBet {
            side: "NO".to_string(),
            bet_size: 5.0,
            start_price: 78000.0,
            end_price: Some(78100.0),
            entry_price: 0.45,
            decision_id: 99,
        };
        let cloned = bet.clone();
        assert_eq!(cloned.side, "NO");
        assert_eq!(cloned.bet_size, 5.0);
        assert_eq!(cloned.end_price, Some(78100.0));
        assert_eq!(cloned.decision_id, 99);
    }
}
