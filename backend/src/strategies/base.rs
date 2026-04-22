//! Strategy base types and helper functions
//! Common utilities used by all strategies

use serde::{Deserialize, Serialize};

/// Trading signal/action
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Signal {
    Yes,  // Buy/Long - betting that outcome will happen
    No,   // Sell/Short - betting against outcome
    Hold, // No action
}

impl Signal {
    pub fn is_trade(&self) -> bool {
        matches!(self, Signal::Yes | Signal::No)
    }

    pub fn as_str(&self) -> &str {
        match self {
            Signal::Yes => "YES",
            Signal::No => "NO",
            Signal::Hold => "HOLD",
        }
    }
}

/// Strategy decision output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyDecision {
    pub signal: Signal,
    pub confidence: f64,
    pub reason: String,
}

impl StrategyDecision {
    pub fn hold(reason: &str) -> Self {
        Self {
            signal: Signal::Hold,
            confidence: 0.0,
            reason: reason.to_string(),
        }
    }

    pub fn trade(signal: Signal, confidence: f64, reason: &str) -> Self {
        Self {
            signal,
            confidence: confidence.clamp(0.0, 1.0),
            reason: reason.to_string(),
        }
    }
}

/// Strategy parameters/thresholds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyParams {
    pub min_delta: f64,
    pub max_delta: f64,
    pub min_price: f64,
    pub max_price: f64,
    pub min_time_remaining: i64,
    pub max_time_remaining: i64,
    pub min_odds: Option<f64>,
    pub max_odds: Option<f64>,
}

impl Default for StrategyParams {
    fn default() -> Self {
        Self {
            min_delta: 0.02,
            max_delta: 5.0,
            min_price: 0.30,
            max_price: 0.70,
            min_time_remaining: 30000,
            max_time_remaining: 300000,
            min_odds: None,
            max_odds: None,
        }
    }
}

/// Strategy context - data provided to each strategy
#[derive(Debug, Clone)]
pub struct StrategyContext {
    pub btc_price: Option<f64>,
    pub btc_price_change: Option<f64>,
    pub btc_window_open: Option<f64>,
    pub polymarket_price: Option<f64>,
    pub time_remaining: i64,
    pub order_book_spread: Option<f64>,
}

/// Strategy trait - each strategy implements this
pub trait Strategy: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn evaluate(&self, ctx: &StrategyContext) -> StrategyDecision;
}

/// Helper: Calculate BTC delta percentage
pub fn calculate_delta(current_price: f64, window_open: f64) -> f64 {
    if window_open <= 0.0 {
        return 0.0;
    }
    ((current_price - window_open) / window_open) * 100.0
}

/// Helper: Calculate fair probability from delta using tanh
pub fn calculate_fair_prob(delta_pct: f64) -> f64 {
    0.5 + (delta_pct / 0.05).tanh() * 0.45
}

/// Helper: Check if price is within acceptable range
pub fn check_price_limits(price: f64, params: &StrategyParams) -> bool {
    price >= params.min_price && price <= params.max_price
}

/// Helper: Check time remaining
pub fn check_time_remaining(time_remaining: i64, params: &StrategyParams) -> bool {
    time_remaining >= params.min_time_remaining && time_remaining <= params.max_time_remaining
}

/// Helper: Check delta threshold
pub fn check_delta(delta_pct: f64, params: &StrategyParams, direction: Option<&str>) -> bool {
    match direction {
        Some("up") => delta_pct > params.min_delta,
        Some("down") => delta_pct < -params.min_delta,
        _ => delta_pct.abs() > params.min_delta,
    }
}
