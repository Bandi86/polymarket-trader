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
use crate::trading::strategy_coordinator::StrategyCoordinator;
use crate::api::market::fetch_active_markets;
use crate::api::CachedCredentials;
use crate::trading::polymarket::{PolymarketClient, OrderRequest};

#[derive(Debug, Clone, serde::Serialize)]
pub enum BotEvent {
    SessionStarted { bot_id: i64, session_id: i64, bot_name: String },
    SessionEnded { bot_id: i64, session_id: i64, final_balance: f64, total_pnl: f64 },
    TradeDecision { bot_id: i64, outcome: String, confidence: f64, bet_size: f64, reason: String },
    OrderExecuted { bot_id: i64, order_id: String },
    BalanceUpdated { bot_id: i64, balance: f64 },
    MarketTransition { new_market_slug: String },
    Error { bot_id: i64, message: String },
    Scanning { bot_id: i64, market_slug: String },
    Evaluating { bot_id: i64, strategy: String, confidence: f64 },
    PositionUpdate { bot_id: i64, side: String, size: f64, price: f64, unrealized_pnl: f64 },
    TradeResult { bot_id: i64, won: bool, pnl: f64 },
}

#[derive(Debug, Clone)]
pub struct PendingBet {
    pub side: String,
    pub bet_size: f64,
    pub start_price: f64,
    pub entry_price: f64,
    pub decision_id: i64,
}

#[derive(Debug, Clone)]
pub struct RunningBot {
    pub bot_id: i64,
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

    pub async fn resume_bot(&self, bot: &BotRecord, current_balance: f64) -> Result<i64, String> {
        let mut running = self.running_bots.write().await;
        if running.contains_key(&bot.id) { return Ok(0); }
        let strategy = StrategyExecutor::new(&bot.strategy_type, &bot.params);
        let session_id = queries::create_session(&self.db, bot.id, bot.user_id, current_balance, Some(bot.params.as_str())).await.unwrap_or(0);
        running.insert(bot.id, RunningBot {
            bot_id: bot.id, session_id, user_id: bot.user_id, strategy, last_market_slug: None,
            consecutive_errors: 0, last_btc_price: None, btc_window_open: None, current_balance,
            pending_bet: None, btc_price_history: Vec::new(),
        });
        self.event_sender.send(BotEvent::SessionStarted { bot_id: bot.id, session_id, bot_name: bot.name.clone() }).ok();
        Ok(session_id)
    }

    pub async fn start_bot(&self, bot: &BotRecord, initial_balance: f64) -> Result<i64, String> {
        let running = self.running_bots.read().await;
        if running.contains_key(&bot.id) { return Err("Bot is already running".to_string()); }
        drop(running);
        queries::update_bot_status(&self.db, bot.id, bot.user_id, "running").await.ok();
        let session_id = queries::create_session(&self.db, bot.id, bot.user_id, initial_balance, Some(bot.params.as_str())).await.map_err(|e| e.to_string())?;
        let mut running = self.running_bots.write().await;
        running.insert(bot.id, RunningBot {
            bot_id: bot.id, session_id, user_id: bot.user_id, strategy: StrategyExecutor::new(&bot.strategy_type, &bot.params), 
            last_market_slug: None, consecutive_errors: 0, last_btc_price: None, btc_window_open: None, 
            current_balance: initial_balance, pending_bet: None, btc_price_history: Vec::new(),
        });
        self.event_sender.send(BotEvent::SessionStarted { bot_id: bot.id, session_id, bot_name: bot.name.clone() }).ok();
        Ok(session_id)
    }

    pub async fn stop_bot(&self, bot_id: i64, user_id: i64) -> Result<(), String> {
        let mut running = self.running_bots.write().await;
        if let Some(rb) = running.remove(&bot_id) {
            queries::update_bot_status(&self.db, bot_id, user_id, "stopped").await.ok();
            self.event_sender.send(BotEvent::SessionEnded { bot_id, session_id: rb.session_id, final_balance: 0.0, total_pnl: 0.0 }).ok();
        }
        Ok(())
    }

    pub async fn execute_cycle(&self, bot_id: i64, user_id: i64, credential_cache: Option<Arc<RwLock<HashMap<i64, CachedCredentials>>>>) -> Result<(), String> {
        let running_bot = { let running = self.running_bots.read().await; running.get(&bot_id).cloned() };
        let mut rb = if let Some(b) = running_bot { b } else { return Ok(()); };

        let bot = queries::get_bot_by_id(&self.db, bot_id, user_id).await.map_err(|e| e.to_string())?.ok_or("Bot not found")?;
        let portfolio = queries::get_portfolio(&self.db, bot_id, user_id).await.map_err(|e| e.to_string())?.ok_or("No portfolio")?;

        // --- STOP LOSS 30% ---
        if portfolio.balance <= portfolio.initial_balance * 0.7 {
            self.stop_bot(bot_id, user_id).await?;
            return Ok(());
        }

        let all_markets = fetch_active_markets("5").await;
        let market = if let Some(m) = all_markets.first() { m.clone() } else { return Ok(()); };
        let btc_price = self.fetch_btc_price().await?;
        let btc_change = rb.last_btc_price.map(|last| (btc_price - last) / last);
        let market_slug = format!("btc-updown-5m-{}", market.end_time);
        
        self.event_sender.send(BotEvent::Scanning { bot_id, market_slug: market_slug.clone() }).ok();

        if rb.last_market_slug.as_ref() != Some(&market_slug) {
            rb.btc_window_open = Some(btc_price);
            rb.last_market_slug = Some(market_slug.clone());
            // Settlement paper trade
            if let Some(ref bet) = rb.pending_bet {
                let diff = (btc_price - bet.start_price) / bet.start_price;
                let won = if bet.side == "YES" { diff > 0.0 } else { diff < 0.0 };
                let pnl = if won { bet.bet_size * (1.0 - bet.entry_price) / bet.entry_price } else { -bet.bet_size };
                queries::record_paper_settlement(&self.db, bot_id, bet.decision_id, won, pnl).await.ok();
                self.event_sender.send(BotEvent::TradeResult { bot_id, won, pnl }).ok();
                rb.pending_bet = None;
            }
        }

        let ctx = StrategyContext {
            btc_price,
            btc_change,
            btc_window_open: rb.btc_window_open,
            yes_price: market.yes_price,
            no_price: market.no_price,
            time_remaining: market.time_remaining,
            btc_velocity: btc_change,
            btc_acceleration: None,
            btc_volatility: None,
        };

        // Javítva: evaluate_with_context használata evaluate_decision helyett
        let signal = rb.strategy.evaluate_with_context(ctx);
        
        // Javítva: Signal enum mintaillesztés és eseményküldés
        if let Signal::Yes(conf) | Signal::No(conf) = signal {
            self.event_sender.send(BotEvent::Evaluating { bot_id, strategy: bot.strategy_type.clone(), confidence: conf }).ok();
            
            if rb.pending_bet.is_none() {
                // Javítva: Signal::Yes(_) használata a matches!-ben
                let outcome = if matches!(signal, Signal::Yes(_)) { "YES" } else { "NO" };
                let price = if outcome == "YES" { market.yes_price } else { market.no_price };
                
                self.event_sender.send(BotEvent::TradeDecision { bot_id, outcome: outcome.to_string(), confidence: conf, bet_size: bot.bet_size, reason: "Signal detected".into() }).ok();
                
                if bot.trading_mode == "live" {
                    if let Some(ref cache) = credential_cache {
                        let c = cache.read().await;
                        if let Some(creds) = c.get(&user_id) {
                            let _ = Self::place_order(&market, outcome, bot.bet_size, creds).await;
                        }
                    }
                } else {
                    let d_id = queries::log_trade_decision(&self.db, bot_id, rb.session_id, user_id, &market_slug, &market.condition_id, outcome, &bot.strategy_type, conf, Some(btc_price), btc_change, Some(market.yes_price), Some(market.no_price), Some(market.time_remaining), "paper trade").await.unwrap_or(0);
                    queries::update_portfolio_balance(&self.db, bot_id, portfolio.balance - bot.bet_size).await.ok();
                    rb.pending_bet = Some(PendingBet { side: outcome.to_string(), bet_size: bot.bet_size, start_price: btc_price, entry_price: price, decision_id: d_id });
                    self.event_sender.send(BotEvent::PositionUpdate { bot_id, side: outcome.to_string(), size: bot.bet_size, price, unrealized_pnl: 0.0 }).ok();
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

    async fn place_order(market: &crate::api::market::ActiveMarket, outcome: &str, bet_size: f64, creds: &CachedCredentials) -> Result<String, String> {
        let order_price = if outcome == "YES" { (market.yes_price * 1.0001).min(0.99) } else { ((1.0 - market.yes_price) * 1.0001).min(0.99) };
        Ok("order_id_simulated".to_string())
    }

    pub async fn is_running(&self, bot_id: i64) -> bool { self.running_bots.read().await.contains_key(&bot_id) }
    pub async fn get_all_running_bots(&self) -> Vec<i64> { self.running_bots.read().await.keys().copied().collect() }
    pub async fn get_running_bots(&self, user_id: i64) -> Vec<i64> { self.running_bots.read().await.iter().filter(|(_, b)| b.user_id == user_id).map(|(id, _)| *id).collect() }
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
    loop { timer.tick().await; let _ = orchestrator.auto_save_sessions().await; }
}
impl BotOrchestrator { pub async fn auto_save_sessions(&self) -> Result<(), String> { Ok(()) } }