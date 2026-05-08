# Strategy Improvement & Testing Plan

**Date:** 2026-05-08
**Project:** Polymarket Trader Strategy Optimization
**Goal:** Find profitable strategy that grows $10 → profit with good win rate on BTC Up/Down 5-min markets

---

## Problem Analysis

### Current Issues
1. **Too high delta thresholds** - Rust `StrictMomentumStrategy` requires 0.15% BTC move, but typical 5-min market BTC movement is 0.02-0.08%. Result: bots HOLD 95% of the time.

2. **No edge calculation** - Current strategies only check delta, don't compare our probability vs market probability.

3. **Missing price velocity** - Polymarket-demo had `priceVelocity`, `btcVelocity`, `btcAcceleration` signals that Rust doesn't use.

### Polymarket-Demo References
- **17 strategies** in `all-strategies.ts` with proven thresholds
- **Edge calculation**: `fair_prob = 0.5 + tanh(delta/0.05) * 0.45`
- **Price range guards**: Only trade when YES/NO price is 30-70¢
- **Competition mode**: 15 bots, $10 start, leaderboard ranking

---

## Proposed Solution

### Phase 1: Rust Strategy Improvements

**1.1 Add Fair Probability Calculation**

```rust
// In base.rs - existing calculate_fair_prob
pub fn calculate_fair_prob(delta_pct: f64) -> f64 {
    0.5 + (delta_pct / 0.05).tanh() * 0.45
}
```

**1.2 Add Edge Calculation to Existing Strategies**

For each strategy, calculate:
- `our_prob = calculate_fair_prob(delta_pct / 100.0)`
- `market_prob = polymarket_price` (YES price)
- `edge = our_prob - market_prob`
- Trade only if `edge > threshold` (e.g., 7-10%)

**1.3 Lower Delta Thresholds**

| Strategy | Current Threshold | New Threshold |
|----------|------------------|---------------|
| Momentum | 0.15% | 0.05% |
| Edge Hunter | 0.05% | 0.03% |
| Mean Reversion | 0.20% | 0.08% |

**1.4 Add Price Range Guards**

Only trade when market price is between 30¢ - 70¢ (avoid extreme odds).

### Phase 2: Paper Trading with 15 Bots

**2.1 Bot Configuration**

```rust
struct BotInstance {
    id: String,
    name: String,
    strategy_type: StrategyType,
    balance: f64,           // Starts at $10
    base_bet: f64,         // $1
    max_bet: f64,          // $5
    multiplier_win: f64,    // 2.0x
    multiplier_lose: f64,  // 0.5x
    consecutive_losses: u8,
    stats: BotStats,
}
```

**2.2 Progressive Betting Rules**

- After WIN: `next_bet = current_bet * multiplier_win` (capped at max_bet)
- After LOSS: `next_bet = current_bet * multiplier_lose` (floored at base_bet * 0.5)
- If balance < $2: bot disabled for remainder of session

**2.3 Competition Mode**

- 15 bots start simultaneously with $10 each
- Each bot runs different strategy configuration
- Leaderboard ranks by: qualified (50+ trades) → P&L → win rate
- Real-time SSE updates to frontend

**2.4 Frontend Display**

- `/bots` page shows all 15 bots with live P&L
- Competition leaderboard component
- Per-bot trade history and stats

### Phase 3: Backtest Runner (Optional)

**3.1 Historical Data Source**

- MongoDB SSE logs from previous sessions
- Or: CSV export from frontend market history
- Target: 50-100 historical 5-min markets

**3.2 Backtest Runner Binary**

```rust
struct BacktestResult {
    strategy_name: String,
    total_trades: u32,
    wins: u32,
    losses: u32,
    win_rate: f64,
    final_balance: f64,
    roi_pct: f64,
    max_drawdown: f64,
}
```

**3.3 Backtest Output**

- Ranked comparison table of all strategies
- Charts: equity curve, drawdown, trade distribution
- Best parameters for each strategy

---

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `backend/src/strategies/base.rs` | Add edge calculation helpers |
| `backend/src/strategies/momentum.rs` | Lower threshold, add edge check |
| `backend/src/strategies/edge_hunter.rs` | Adjust edge threshold |
| `backend/src/strategies/strict_momentum.rs` | Lower threshold to 0.08% |
| `backend/src/trading/bot.rs` | Add BotInstance struct, progressive betting |
| `backend/src/api/bots.rs` | Add competition endpoints |
| `frontend/src/store/` | Add bots state with per-bot tracking |

### New Files

| File | Purpose |
|------|---------|
| `backend/src/trading/competition.rs` | CompetitionManager logic |
| `frontend/src/components/bot-leaderboard.tsx` | Live leaderboard UI |

---

## Testing Plan

### Paper Trading Test
1. Start 15 bots in competition mode
2. Run for 50+ 5-min markets (approximately 4-5 hours)
3. Measure: win rate, ROI, max drawdown per bot
4. Select top 2-3 strategies for live trading

### Success Criteria
- Win rate > 55% (to beat 50% random + fees)
- ROI > 10% over 50 trades ($10 → $11+)
- No bot completely depletes (< $2)

---

## Alternative Approaches Considered

**A: Keep current Rust strategies, just tweak thresholds**
- Pros: Minimal code changes
- Cons: Still no edge calculation, may not find profitable strategy

**B: Python strategy evaluator + Rust orchestrator**
- Pros: Reuse polymarket-demo code, better strategies
- Cons: Complex IPC, two codebases to maintain

**C: Research-first (backtest before paper)**
- Pros: Scientific validation
- Cons: Need historical data, slower iteration

**Selected: B approach hybrid** - Implement Rust improvements (Phase 1) while preparing for Python strategy bridge (future). Run paper trading first (Phase 2) to get real results quickly.

---

## Next Steps

1. [ ] Implement Phase 1: Rust strategy improvements
2. [ ] Add BotInstance + progressive betting to backend
3. [ ] Wire up 15 bots with different strategies
4. [ ] Frontend leaderboard display
5. [ ] Run paper trading competition
6. [ ] Evaluate results, select best strategies