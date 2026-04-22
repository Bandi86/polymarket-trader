//! Strategy execution for bot executor

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Signal {
    Yes(f64),  // Buy YES, confidence 0-1
    No(f64),   // Buy NO (sell YES), confidence 0-1
    Hold(String), // No action, reason
}

/// Strategy context - all data needed for strategy evaluation
#[derive(Debug, Clone)]
pub struct StrategyContext {
    pub btc_price: f64,
    pub btc_change: Option<f64>,
    pub btc_window_open: Option<f64>,
    pub yes_price: f64,
    pub no_price: f64,
    pub time_remaining: i64, // milliseconds
}

/// Strategy executor - evaluates BTC price and generates trading signals
#[derive(Debug, Clone)]
pub struct StrategyExecutor {
    strategy_type: String,
    params: StrategyParams,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct StrategyParams {
    pub min_delta: f64,        // Minimum BTC change percentage (e.g., 0.0007 = 0.07%)
    pub min_price: f64,        // Minimum market price to buy (e.g., 0.30)
    pub max_price: f64,        // Maximum market price to buy (e.g., 0.70)
    pub min_time_remaining: i64, // Minimum time remaining to trade (ms)
    pub max_time_remaining: i64, // Maximum time remaining to start trading (ms)
}

impl Default for StrategyParams {
    fn default() -> Self {
        Self {
            min_delta: 0.0007,      // 0.07% - reasonable for 5min markets
            min_price: 0.30,
            max_price: 0.70,
            min_time_remaining: 3000,   // 3 seconds minimum
            max_time_remaining: 270000, // 4.5 minutes maximum (skip first 30s)
        }
    }
}

impl StrategyExecutor {
    pub fn new(strategy_type: &str, params_json: &str) -> Self {
        let params: StrategyParams = serde_json::from_str(params_json).unwrap_or_default();
        tracing::debug!("Created {} strategy with min_delta={:.4}", strategy_type, params.min_delta);

        Self {
            strategy_type: strategy_type.to_string(),
            params,
        }
    }

    /// Evaluate the strategy and return a signal
    pub fn evaluate(&self, btc_price: f64, btc_change: Option<f64>) -> Signal {
        // Legacy method - use evaluate_with_context for full functionality
        let ctx = StrategyContext {
            btc_price,
            btc_change,
            btc_window_open: None,
            yes_price: 0.5,
            no_price: 0.5,
            time_remaining: 60000,
        };
        self.evaluate_with_context(ctx)
    }

    /// Evaluate with full market context
    pub fn evaluate_with_context(&self, ctx: StrategyContext) -> Signal {
        match self.strategy_type.as_str() {
            "window_delta" => self.evaluate_window_delta(ctx),
            "binance_signal" | "oracle_lag" => self.evaluate_oracle_lag(ctx),
            "last_seconds_scalp" => self.evaluate_last_seconds_scalp(ctx),
            "momentum" => self.evaluate_momentum(ctx),
            "trend" => self.evaluate_trend(ctx),
            "volatility" | "volatility_breakout" => self.evaluate_volatility(ctx),
            "sniper" => self.evaluate_sniper(ctx),
            "contrarian" => self.evaluate_contrarian(ctx),
            "mean_reversion" => self.evaluate_mean_reversion(ctx),
            "binance_velocity" | "velocity" => self.evaluate_velocity(ctx),
            "fair_value" => self.evaluate_fair_value(ctx),
            "price_reversion" => self.evaluate_price_reversion(ctx),
            _ => Signal::Hold(format!("Unknown strategy: {}", self.strategy_type)),
        }
    }

    /// Check if price is within acceptable range for trading
    fn check_price_limits(&self, action: &str, yes_price: f64, no_price: f64) -> bool {
        let target_price = if action == "YES" { yes_price } else { no_price };
        target_price >= self.params.min_price && target_price <= self.params.max_price
    }

    /// #1 WINDOW_DELTA - The best 5min strategy from demo
    /// Compares BTC price vs window opening price
    fn evaluate_window_delta(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late to trade".to_string());
        }

        if ctx.time_remaining > self.params.max_time_remaining {
            return Signal::Hold("Window just started".to_string());
        }

        if ctx.btc_price == 0.0 {
            return Signal::Hold("No BTC price".to_string());
        }

        // Calculate delta from window open
        let window_open = ctx.btc_window_open.unwrap_or(ctx.btc_price);
        let delta_pct = if window_open > 0.0 {
            ((ctx.btc_price - window_open) / window_open) * 100.0
        } else {
            0.0
        };

        // Strong signal: delta > 0.12%
        if delta_pct > 0.12 && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            let confidence = (0.70_f64 + (delta_pct - 0.12) * 3.0).min(0.92_f64);
            return Signal::Yes(confidence);
        }
        if delta_pct < -0.12 && self.check_price_limits("NO", ctx.yes_price, ctx.no_price) {
            let confidence = (0.70_f64 + (-delta_pct - 0.12) * 3.0).min(0.92_f64);
            return Signal::No(confidence);
        }

        // Medium signal: delta > 0.07%
        if delta_pct > 0.07 && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            let confidence = (0.55_f64 + (delta_pct - 0.07) * 4.0).min(0.78_f64);
            return Signal::Yes(confidence);
        }
        if delta_pct < -0.07 && self.check_price_limits("NO", ctx.yes_price, ctx.no_price) {
            let confidence = (0.55_f64 + (-delta_pct - 0.07) * 4.0).min(0.78_f64);
            return Signal::No(confidence);
        }

        Signal::Hold(format!("Delta too small: {:.4}%", delta_pct))
    }

    /// #2 ORACLE_LAG - Uses BTC change to predict market direction
    fn evaluate_oracle_lag(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too close to close".to_string());
        }

        let change = match ctx.btc_change {
            Some(c) => c * 100.0, // Convert to percentage
            None => return Signal::Hold("No BTC data".to_string()),
        };

        let threshold = self.params.min_delta * 100.0 * 0.5; // Lower threshold

        if change > threshold && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            Signal::Yes(0.70)
        } else if change < -threshold && self.check_price_limits("NO", ctx.yes_price, ctx.no_price) {
            Signal::No(0.70)
        } else {
            Signal::Hold(format!("No oracle lag: {:.4}%", change))
        }
    }

    /// #3 LAST_SECONDS_SCALP - T-10 Sniper
    /// Only active in the last 10-30 seconds
    fn evaluate_last_seconds_scalp(&self, ctx: StrategyContext) -> Signal {
        // Only active in last 30 seconds (4s minimum)
        if ctx.time_remaining > 30000 || ctx.time_remaining < 4000 {
            return Signal::Hold("Outside T-10 window".to_string());
        }

        if ctx.btc_price == 0.0 {
            return Signal::Hold("No BTC price".to_string());
        }

        let window_open = ctx.btc_window_open.unwrap_or(ctx.btc_price);
        let delta_pct = if window_open > 0.0 {
            ((ctx.btc_price - window_open) / window_open) * 100.0
        } else {
            0.0
        };

        // Min delta: 0.04%
        if delta_pct.abs() < 0.04 {
            return Signal::Hold(format!("Delta too small: {:.4}%", delta_pct));
        }

        let action = if delta_pct > 0.0 { "YES" } else { "NO" };
        let target_price = if action == "YES" { ctx.yes_price } else { ctx.no_price };

        // Price limits: 25-75 cents
        if target_price > 0.75 {
            return Signal::Hold(format!("Price too high: {:.0}c", target_price * 100.0));
        }
        if target_price < 0.25 {
            return Signal::Hold(format!("Price too low: {:.0}c", target_price * 100.0));
        }

        let confidence = 0.60_f64 + (delta_pct.abs() * 3.0).min(0.25_f64);
        if action == "YES" {
            Signal::Yes(confidence.min(0.85_f64))
        } else {
            Signal::No(confidence.min(0.85_f64))
        }
    }

    /// Momentum strategy - follows recent direction
    fn evaluate_momentum(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late".to_string());
        }

        let change = match ctx.btc_change {
            Some(c) => c,
            None => return Signal::Hold("No BTC data".to_string()),
        };

        if change > self.params.min_delta && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            Signal::Yes(0.65)
        } else if change < -self.params.min_delta && self.check_price_limits("NO", ctx.yes_price, ctx.no_price) {
            Signal::No(0.65)
        } else {
            Signal::Hold(format!("No momentum: {:.2}%", change * 100.0))
        }
    }

    /// Trend strategy - requires stronger confirmation
    fn evaluate_trend(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late".to_string());
        }

        let change = match ctx.btc_change {
            Some(c) => c,
            None => return Signal::Hold("No BTC data".to_string()),
        };

        let threshold = self.params.min_delta * 1.5;

        if change > threshold && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            Signal::Yes(0.75)
        } else if change < -threshold && self.check_price_limits("NO", ctx.yes_price, ctx.no_price) {
            Signal::No(0.75)
        } else {
            Signal::Hold(format!("No strong trend: {:.2}%", change * 100.0))
        }
    }

    /// Volatility strategy - catches sudden moves
    fn evaluate_volatility(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late".to_string());
        }

        let change = match ctx.btc_change {
            Some(c) => c.abs(),
            None => return Signal::Hold("No BTC data".to_string()),
        };

        let threshold = self.params.min_delta * 2.0;

        if change > threshold && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            Signal::Yes(0.70)
        } else {
            Signal::Hold(format!("Low volatility: {:.2}%", change * 100.0))
        }
    }

    /// Sniper strategy - high confidence, low frequency
    fn evaluate_sniper(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late".to_string());
        }

        let change = match ctx.btc_change {
            Some(c) => c.abs(),
            None => return Signal::Hold("No BTC data".to_string()),
        };

        let threshold = self.params.min_delta * 2.0;

        if change > threshold && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            Signal::Yes(0.85)
        } else {
            Signal::Hold("Waiting for sniper setup".to_string())
        }
    }

    /// Contrarian - bets against movement
    fn evaluate_contrarian(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late".to_string());
        }

        let change = match ctx.btc_change {
            Some(c) => c,
            None => return Signal::Hold("No BTC data".to_string()),
        };

        // Price up -> bet NO, Price down -> bet YES
        if change > self.params.min_delta && self.check_price_limits("NO", ctx.yes_price, ctx.no_price) {
            Signal::No(0.60)
        } else if change < -self.params.min_delta && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            Signal::Yes(0.60)
        } else {
            Signal::Hold("No contrarian signal".to_string())
        }
    }

    /// Mean reversion - bets on return to 0.5
    fn evaluate_mean_reversion(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late".to_string());
        }

        // If market price is extreme, bet on reversion
        if ctx.yes_price > 0.75 && self.check_price_limits("NO", ctx.yes_price, ctx.no_price) {
            Signal::No(0.55)
        } else if ctx.yes_price < 0.25 && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            Signal::Yes(0.55)
        } else {
            Signal::Hold(format!("Price near fair value: {:.0}c", ctx.yes_price * 100.0))
        }
    }

    /// Velocity - tracks speed of price change
    fn evaluate_velocity(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late".to_string());
        }

        let change = match ctx.btc_change {
            Some(c) => c.abs(),
            None => return Signal::Hold("No BTC data".to_string()),
        };

        if change > self.params.min_delta && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            Signal::Yes(0.65)
        } else {
            Signal::Hold("Low velocity".to_string())
        }
    }

    /// Fair value - basic arbitrage around 0.5
    fn evaluate_fair_value(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late".to_string());
        }

        // If price is above 0.5, bet NO (expect down)
        // If price is below 0.5, bet YES (expect up)
        if ctx.yes_price > 0.55 && ctx.yes_price <= self.params.max_price {
            Signal::No(0.55)
        } else if ctx.yes_price < 0.45 && ctx.yes_price >= self.params.min_price {
            Signal::Yes(0.55)
        } else {
            Signal::Hold(format!("Near fair value: {:.0}c", ctx.yes_price * 100.0))
        }
    }

    /// Price reversion - bets when price deviates significantly
    fn evaluate_price_reversion(&self, ctx: StrategyContext) -> Signal {
        if ctx.time_remaining < self.params.min_time_remaining {
            return Signal::Hold("Too late".to_string());
        }

        // Strong reversion when price is very extreme
        if ctx.yes_price > 0.80 {
            Signal::No(0.65)
        } else if ctx.yes_price < 0.20 {
            Signal::Yes(0.65)
        } else if ctx.yes_price > 0.65 && self.check_price_limits("NO", ctx.yes_price, ctx.no_price) {
            Signal::No(0.50)
        } else if ctx.yes_price < 0.35 && self.check_price_limits("YES", ctx.yes_price, ctx.no_price) {
            Signal::Yes(0.50)
        } else {
            Signal::Hold(format!("No extreme price: {:.0}c", ctx.yes_price * 100.0))
        }
    }
}