//! Momentum Strategy - Uses BTC price momentum to generate signals
//!
//! Based on short-term BTC price changes to predict market direction

use super::base::{
    check_delta, check_time_remaining, calculate_delta, Signal, Strategy, StrategyContext,
    StrategyDecision, StrategyParams,
};

pub struct MomentumStrategy {
    params: StrategyParams,
}

impl MomentumStrategy {
    pub fn new(params: StrategyParams) -> Self {
        Self { params }
    }

    pub fn default() -> Self {
        Self {
            params: StrategyParams {
                min_delta: 0.02,
                ..Default::default()
            },
        }
    }
}

impl Strategy for MomentumStrategy {
    fn name(&self) -> &str {
        "Momentum"
    }

    fn description(&self) -> &str {
        "BTC momentum based trading - follows short-term price momentum"
    }

    fn evaluate(&self, ctx: &StrategyContext) -> StrategyDecision {
        // Check time remaining
        if !check_time_remaining(ctx.time_remaining, &self.params) {
            return StrategyDecision::hold("Too close to market close");
        }

        // Check BTC price change from context
        if let Some(btc_change) = ctx.btc_price_change {
            if btc_change.abs() > 0.0005 {
                let pct = btc_change * 100.0;

                if pct > self.params.min_delta {
                    let confidence = (0.50 + pct * 5.0).min(0.78);
                    return StrategyDecision::trade(
                        Signal::Yes,
                        confidence,
                        &format!("BTC momentum +{:.3}%", pct),
                    );
                }
                if pct < -self.params.min_delta {
                    let confidence = (0.50 + (-pct) * 5.0).min(0.78);
                    return StrategyDecision::trade(
                        Signal::No,
                        confidence,
                        &format!("BTC momentum {:.3}%", pct),
                    );
                }
            }
        }

        // Fallback: use window delta
        if let (Some(btc_price), Some(window_open)) = (ctx.btc_price, ctx.btc_window_open) {
            let delta_pct = calculate_delta(btc_price, window_open);

            if check_delta(delta_pct, &self.params, Some("up")) {
                let confidence = (0.50 + delta_pct * 4.0).min(0.70);
                return StrategyDecision::trade(
                    Signal::Yes,
                    confidence,
                    &format!("Window momentum +{:.3}%", delta_pct),
                );
            }
            if check_delta(delta_pct, &self.params, Some("down")) {
                let confidence = (0.50 + (-delta_pct) * 4.0).min(0.70);
                return StrategyDecision::trade(
                    Signal::No,
                    confidence,
                    &format!("Window momentum {:.3}%", delta_pct),
                );
            }
        }

        StrategyDecision::hold("No significant momentum detected")
    }
}
