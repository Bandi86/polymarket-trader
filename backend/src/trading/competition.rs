//! Competition Mode - 15 bots compete with $10 starting balance

use serde::{Deserialize, Serialize};
use crate::trading::bot_executor::strategies::{Signal, StrategyExecutor, StrategyContext};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotStats {
    pub trades: u32,
    pub wins: u32,
    pub losses: u32,
    pub pnl: f64,
    pub win_rate: f64,
}

#[derive(Debug, Clone)]
pub struct PendingBet {
    pub side: String,
    pub bet_size: f64,
    pub start_price: f64,
    pub entry_price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotInstance {
    pub id: String,
    pub name: String,
    pub strategy_type: String,
    pub balance: f64,
    pub base_bet: f64,
    pub max_bet: f64,
    pub multiplier_win: f64,
    pub multiplier_lose: f64,
    pub current_bet: f64,
    pub consecutive_losses: u8,
    pub stats: BotStats,
    pub enabled: bool,
    #[serde(skip)]
    pub pending_bet: Option<PendingBet>,
    #[serde(skip)]
    pub last_market_slug: Option<String>,
    #[serde(skip)]
    pub btc_window_open: Option<f64>,
}

impl BotInstance {
    pub fn new(id: &str, name: &str, strategy: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            strategy_type: strategy.to_string(),
            balance: 10.0,
            base_bet: 1.0,
            max_bet: 5.0,
            multiplier_win: 2.0,
            multiplier_lose: 0.5,
            current_bet: 1.0,
            consecutive_losses: 0,
            stats: BotStats {
                trades: 0,
                wins: 0,
                losses: 0,
                pnl: 0.0,
                win_rate: 0.0,
            },
            enabled: true,
            pending_bet: None,
            last_market_slug: None,
            btc_window_open: None,
        }
    }

    /// Calculate next bet size based on last trade result
    pub fn update_bet(&mut self, won: bool) {
        if won {
            self.current_bet = (self.current_bet * self.multiplier_win).min(self.max_bet);
            self.consecutive_losses = 0;
        } else {
            self.current_bet = (self.current_bet * self.multiplier_lose).max(self.base_bet * 0.5);
            self.consecutive_losses += 1;
        }

        // Disable if balance too low
        if self.balance < 2.0 {
            self.enabled = false;
        }
    }

    /// Apply trade result
    pub fn apply_trade(&mut self, won: bool, pnl: f64) {
        self.balance = (self.balance + pnl).max(0.0);
        self.stats.trades += 1;

        if won {
            self.stats.wins += 1;
        } else {
            self.stats.losses += 1;
        }

        self.stats.pnl += pnl;
        self.stats.win_rate = if self.stats.trades > 0 {
            self.stats.wins as f64 / self.stats.trades as f64
        } else {
            0.0
        };

        self.update_bet(won);
    }

    /// Evaluate strategy and return (side, confidence) or None if no trade
    pub fn evaluate_cycle(&mut self, btc_price: f64, btc_change: Option<f64>, yes_price: f64, no_price: f64, time_remaining: i64, btc_window_open: Option<f64>) -> Option<(String, f64)> {
        if !self.enabled || self.balance < self.base_bet {
            return None;
        }

        let ctx = StrategyContext {
            btc_price,
            btc_change,
            btc_window_open,
            yes_price,
            no_price,
            time_remaining: time_remaining * 1000, // Convert seconds to milliseconds
            btc_velocity: None,
            btc_acceleration: None,
            btc_volatility: None,
        };

        let executor = StrategyExecutor::new(&self.strategy_type, "{}");
        let signal = executor.evaluate_with_context(ctx);

        match signal {
            Signal::Yes(conf) => Some(("YES".to_string(), conf)),
            Signal::No(conf) => Some(("NO".to_string(), conf)),
            Signal::Hold(_) => None,
        }
    }

    /// Execute a trade based on signal
    pub fn execute_trade(&mut self, side: &str, price: f64, btc_start: f64, btc_end: f64) -> bool {
        let bet_size = self.current_bet.min(self.balance);
        if bet_size < 0.50 {
            return false;
        }

        let diff = (btc_end - btc_start) / btc_start;
        let won = if side == "YES" { diff > 0.0 } else { diff < 0.0 };
        let profit = if won { bet_size * (1.0 - price) } else { -bet_size };

        self.balance += profit;
        self.stats.trades += 1;
        if won { self.stats.wins += 1; } else { self.stats.losses += 1; }
        self.stats.pnl += profit;
        self.stats.win_rate = self.stats.wins as f64 / self.stats.trades as f64;
        self.update_bet(won);

        if self.balance < 2.0 {
            self.enabled = false;
        }

        true
    }
}

#[derive(Clone)]
pub struct CompetitionManager {
    bots: Vec<BotInstance>,
    state: CompetitionState,
}

impl CompetitionManager {
    pub fn new() -> Self {
        Self {
            bots: Vec::new(),
            state: CompetitionState::default(),
        }
    }

    pub fn start(&mut self, configs: Vec<(&str, &str)>, initial_btc_price: Option<f64>) -> &CompetitionState {
        // configs: Vec of (bot_id, strategy_type)
        self.bots.clear();
        for (id, strategy) in configs {
            let name = if id.len() >= 8 {
                format!("Bot-{}", &id[..8])
            } else {
                format!("Bot-{}", id)
            };
            let mut bot = BotInstance::new(id, &name, strategy);
            // Initialize btc_window_open so strategies can trade immediately
            bot.btc_window_open = initial_btc_price;
            self.bots.push(bot);
        }

        self.state.active = true;
        self.state.start_time = chrono::Utc::now().timestamp_millis();
        self.state.entries.clear();

        &self.state
    }

    pub fn get_bot(&mut self, bot_id: &str) -> Option<&mut BotInstance> {
        self.bots.iter_mut().find(|b| b.id == bot_id)
    }

    pub fn apply_trade(&mut self, bot_id: &str, won: bool, pnl: f64) -> bool {
        if let Some(bot) = self.get_bot(bot_id) {
            bot.apply_trade(won, pnl);
            return true;
        }
        false
    }

    pub fn update_leaderboard(&mut self) -> &Vec<LeaderboardEntry> {
        let min_trades = self.state.min_trades;

        // Sort bots by: qualified (min_trades) → P&L → win rate
        let mut sorted: Vec<&mut BotInstance> = self.bots.iter_mut().collect();
        sorted.sort_by(|a, b| {
            let a_qualified = a.stats.trades >= min_trades;
            let b_qualified = b.stats.trades >= min_trades;

            if a_qualified != b_qualified {
                return if a_qualified { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
            }

            let pnl_cmp = b.stats.pnl.partial_cmp(&a.stats.pnl).unwrap_or(std::cmp::Ordering::Equal);
            if pnl_cmp != std::cmp::Ordering::Equal {
                return pnl_cmp;
            }

            b.stats.win_rate.partial_cmp(&a.stats.win_rate).unwrap_or(std::cmp::Ordering::Equal)
        });

        // Build leaderboard
        self.state.entries.clear();
        for (i, bot) in sorted.iter().enumerate() {
            let roi = ((bot.balance - self.state.start_balance) / self.state.start_balance) * 100.0;
            self.state.entries.push(LeaderboardEntry {
                bot_id: bot.id.clone(),
                bot_name: bot.name.clone(),
                strategy: bot.strategy_type.clone(),
                rank: (i + 1) as u32,
                trades: bot.stats.trades,
                win_rate: bot.stats.win_rate,
                pnl: bot.stats.pnl,
                roi,
                balance: bot.balance,
            });
        }

        &self.state.entries
    }

    pub fn get_state(&self) -> &CompetitionState {
        &self.state
    }

    pub fn stop(&mut self) -> &CompetitionState {
        self.state.active = false;
        &self.state
    }

    /// Run one competition cycle - called by orchestrator's periodic task
    pub fn run_cycle(&mut self, btc_price: f64, market_slug: &str, yes_price: f64, no_price: f64, time_remaining: i64) {
        if !self.state.active {
            return;
        }

        tracing::debug!("[COMPETITION] run_cycle for {} bots, btc={}, market={}", self.bots.len(), btc_price, market_slug);

        for bot in &mut self.bots {
            // Check market transition - settle pending bet
            let market_changed = bot.last_market_slug.as_ref() != Some(&market_slug.to_string());
            let market_ended = time_remaining <= 5;

            if market_changed || market_ended {
                if let Some(bet) = bot.pending_bet.take() {
                    let diff = (btc_price - bet.start_price) / bet.start_price;
                    let won = if bet.side == "YES" { diff > 0.0 } else { diff < 0.0 };
                    let profit = if won { bet.bet_size * (1.0 - bet.entry_price) } else { -bet.bet_size };
                    bot.balance = (bot.balance + profit).max(0.0);
                    bot.stats.trades += 1;
                    if won { bot.stats.wins += 1; } else { bot.stats.losses += 1; }
                    bot.stats.pnl += profit;
                    bot.stats.win_rate = bot.stats.wins as f64 / bot.stats.trades as f64;
                    bot.update_bet(won);
                    tracing::info!("[COMPETITION] {} {} won={} profit={:.4} balance={:.2}", bot.id, bet.side, won, profit, bot.balance);
                }

                if market_changed {
                    bot.btc_window_open = Some(btc_price);
                    bot.last_market_slug = Some(market_slug.to_string());
                    tracing::info!("[COMPETITION] {} new market window, btc_window_open={}", bot.id, btc_price);
                }
            }

            // Evaluate strategy if no pending bet
            if bot.pending_bet.is_none() && bot.enabled && bot.balance >= bot.base_bet {
                let btc_change = bot.btc_window_open.map(|w| (btc_price - w) / w);

                if let Some((side, confidence)) = bot.evaluate_cycle(btc_price, btc_change, yes_price, no_price, time_remaining, bot.btc_window_open) {
                    let bet_size = bot.current_bet.min(bot.balance).max(0.50);
                    if bet_size >= 0.50 {
                        let entry_price = if side == "YES" { yes_price } else { no_price };
                        bot.pending_bet = Some(PendingBet {
                            side: side.clone(),
                            bet_size,
                            start_price: btc_price,
                            entry_price,
                        });
                        tracing::info!("[COMPETITION] {} signal: {} (conf={:.2}) bet=${:.2}", bot.id, side, confidence, bet_size);
                    }
                }
            }
        }
    }

    /// Check if competition is active
    pub fn is_active(&self) -> bool {
        self.state.active
    }
}

impl Default for CompetitionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub bot_id: String,
    pub bot_name: String,
    pub strategy: String,
    pub rank: u32,
    pub trades: u32,
    pub win_rate: f64,
    pub pnl: f64,
    pub roi: f64,
    pub balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitionState {
    pub active: bool,
    pub start_time: i64,
    pub min_trades: u32,
    pub start_balance: f64,
    pub entries: Vec<LeaderboardEntry>,
}

impl Default for CompetitionState {
    fn default() -> Self {
        Self {
            active: false,
            start_time: 0,
            min_trades: 50,
            start_balance: 10.0,
            entries: Vec::new(),
        }
    }
}