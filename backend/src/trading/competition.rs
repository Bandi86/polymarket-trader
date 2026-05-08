//! Competition Mode - 15 bots compete with $10 starting balance

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotStats {
    pub trades: u32,
    pub wins: u32,
    pub losses: u32,
    pub pnl: f64,
    pub win_rate: f64,
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
}

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

    pub fn start(&mut self, configs: Vec<(&str, &str)>) -> &CompetitionState {
        // configs: Vec of (bot_id, strategy_type)
        self.bots.clear();
        for (id, strategy) in configs {
            let name = format!("Bot-{}", &id[..8]);
            self.bots.push(BotInstance::new(id, &name, strategy));
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