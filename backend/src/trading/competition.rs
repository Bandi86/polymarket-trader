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