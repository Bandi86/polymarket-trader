# Strategy Improvement & Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Rust strategies with edge calculation, lower thresholds, and progressive betting. Run 15-bot paper trading competition to find profitable strategy.

**Architecture:** Phase 1 adds edge calculation to existing strategies. Phase 2 creates BotInstance + CompetitionManager for paper trading. Phase 3 builds backtest runner for historical validation.

**Tech Stack:** Rust (Axum, SQLite, tokio), TypeScript/Next.js (frontend)

---

## Phase 1 Tasks

### Task 1: Add Edge Calculation Helper to base.rs

**Files:**
- Modify: `backend/src/strategies/base.rs:100-130`

- [ ] **Step 1: Read current base.rs edge section**

Run: `cat backend/src/strategies/base.rs | head -140`

- [ ] **Step 2: Add edge calculation function after calculate_fair_prob**

```rust
/// Calculate edge: positive means we have advantage over market
/// edge = our_prob - market_prob
/// e.g., if our_prob=0.55 and market_prob=0.52, edge=0.03 (3% advantage)
pub fn calculate_edge(our_prob: f64, market_prob: f64) -> f64 {
    our_prob - market_prob
}

/// Check if edge is sufficient for trading
/// min_edge default 0.07 (7%) - only trade if we have 7%+ advantage
pub fn has_sufficient_edge(our_prob: f64, market_prob: f64, min_edge: f64) -> bool {
    calculate_edge(our_prob, market_prob).abs() > min_edge
}
```

- [ ] **Step 3: Add tests for edge calculation**

Add to `backend/src/strategies/base.rs` tests section (after line 227):

```rust
#[test]
fn test_calculate_edge_positive() {
    let edge = calculate_edge(0.55, 0.52);
    assert!((edge - 0.03).abs() < 0.001);
}

#[test]
fn test_calculate_edge_negative() {
    let edge = calculate_edge(0.48, 0.52);
    assert!((edge - (-0.04)).abs() < 0.001);
}

#[test]
fn test_has_sufficient_edge_true() {
    assert!(has_sufficient_edge(0.57, 0.50, 0.07));
}

#[test]
fn test_has_sufficient_edge_false() {
    assert!(!has_sufficient_edge(0.55, 0.52, 0.07)); // 3% < 7% threshold
}
```

- [ ] **Step 4: Run tests to verify**

Run: `cd backend && cargo test base::tests -- --nocapture`
Expected: All 4 new tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/strategies/base.rs
git commit -m "feat(strategies): add edge calculation helpers"
```

---

### Task 2: Update MomentumStrategy with lower threshold + edge check

**Files:**
- Modify: `backend/src/strategies/momentum.rs:20-95`

- [ ] **Step 1: Read current momentum.rs**

Run: `cat backend/src/strategies/momentum.rs`

- [ ] **Step 2: Update StrategyParams defaults**

Change from:
```rust
min_delta: 0.02,
```
To:
```rust
min_delta: 0.05,  // Lowered from 0.15 for more trades
```

- [ ] **Step 3: Add edge check to evaluate method**

Add after line 46 (after time remaining check):

```rust
// Check edge - only trade if we have sufficient advantage
if let Some(pm_price) = ctx.polymarket_price {
    let our_prob = calculate_fair_prob(btc_change);
    let edge = calculate_edge(our_prob, pm_price);
    let min_edge = 0.07; // 7% minimum edge
    
    if edge.abs() < min_edge {
        return StrategyDecision::hold(&format!(
            "Edge {:.1}% < {:.0}% threshold", 
            edge * 100.0, min_edge * 100.0
        ));
    }
}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && cargo test momentum -- --nocapture`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/strategies/momentum.rs
git commit -m "feat(strategy): add edge check to momentum"
```

---

### Task 3: Update StrictMomentumStrategy threshold

**Files:**
- Modify: `backend/src/strategies/strict_momentum.rs:24-37`

- [ ] **Step 1: Read current strict_momentum.rs**

Run: `cat backend/src/strategies/strict_momentum.rs`

- [ ] **Step 2: Lower min_delta threshold**

Change from:
```rust
min_delta: 0.15,     // MUCH higher threshold - only strong moves
```
To:
```rust
min_delta: 0.08,     // Lowered from 0.15 to capture more moves
```

- [ ] **Step 3: Run tests**

Run: `cd backend && cargo test strict_momentum -- --nocapture`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/strategies/strict_momentum.rs
git commit -m "feat(strategy): lower strict_momentum threshold to 0.08%"
```

---

### Task 4: Update EdgeHunterStrategy edge threshold

**Files:**
- Modify: `backend/src/strategies/edge_hunter.rs:25-38`

- [ ] **Step 1: Read current edge_hunter.rs**

Run: `cat backend/src/strategies/edge_hunter.rs`

- [ ] **Step 2: Adjust min_edge to 0.05 (5%)**

Change from:
```rust
min_edge: 0.03,          // Need 3% edge minimum
```
To:
```rust
min_edge: 0.05,          // Need 5% edge minimum (balanced)
```

Also update min_delta to 0.03:
```rust
min_delta: 0.03,      // Lowered from 0.05
```

- [ ] **Step 3: Run tests**

Run: `cd backend && cargo test edge_hunter -- --nocapture`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/strategies/edge_hunter.rs
git commit -m "feat(strategy): adjust edge_hunter thresholds"
```

---

## Phase 2 Tasks

### Task 5: Create Competition State Types

**Files:**
- Create: `backend/src/trading/competition.rs`
- Modify: `backend/src/trading/mod.rs:14`

- [ ] **Step 1: Create competition.rs with BotInstance struct**

```rust
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
```

- [ ] **Step 2: Export from mod.rs**

Add to `backend/src/trading/mod.rs`:
```rust
pub mod competition;
pub use competition::{BotInstance, BotStats, CompetitionState, LeaderboardEntry};
```

- [ ] **Step 3: Run tests**

Run: `cd backend && cargo build`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add backend/src/trading/competition.rs backend/src/trading/mod.rs
git commit -m "feat(competition): add BotInstance and competition state types"
```

---

### Task 6: Create CompetitionManager

**Files:**
- Modify: `backend/src/trading/competition.rs`

- [ ] **Step 1: Add CompetitionManager struct**

Add after BotInstance impl (around line 95):

```rust
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
```

- [ ] **Step 2: Run build**

Run: `cd backend && cargo build`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add backend/src/trading/competition.rs
git commit -m "feat(competition): add CompetitionManager"
```

---

### Task 7: Wire up 15 Competition Bots in Orchestrator

**Files:**
- Modify: `backend/src/trading/orchestrator.rs:1-50`

- [ ] **Step 1: Read current orchestrator.rs header**

Run: `head -80 backend/src/trading/orchestrator.rs`

- [ ] **Step 2: Add competition import**

Add after existing imports:
```rust
use crate::trading::competition::{CompetitionManager, BotInstance};
```

- [ ] **Step 3: Add competition_manager field to Orchestrator**

Find struct Orchestrator and add:
```rust
pub competition_manager: CompetitionManager,
```

- [ ] **Step 4: Initialize competition_manager in new()**

Add in Orchestrator::new():
```rust
competition_manager: CompetitionManager::new(),
```

- [ ] **Step 5: Add competition endpoint handler**

Add to `backend/src/api/bots.rs` or create competition endpoint.

- [ ] **Step 6: Run build**

Run: `cd backend && cargo build 2>&1 | head -50`
Expected: Compiles successfully (may have warnings)

- [ ] **Step 7: Commit**

```bash
git add backend/src/trading/orchestrator.rs
git commit -m "feat(orchestrator): add competition manager integration"
```

---

### Task 8: Frontend Bot Leaderboard Component

**Files:**
- Create: `frontend/src/components/bot-leaderboard.tsx`
- Modify: `frontend/src/store/index.ts` (add bots state)

- [ ] **Step 1: Create BotLeaderboard component**

```tsx
'use client';

import { useState, useEffect } from 'react';

interface LeaderboardEntry {
  bot_id: string;
  bot_name: string;
  strategy: string;
  rank: number;
  trades: number;
  win_rate: number;
  pnl: number;
  roi: number;
  balance: number;
}

export function BotLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Poll backend for leaderboard updates
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('/api/competition/leaderboard');
        const data = await res.json();
        setEntries(data.entries || []);
        setLoading(false);
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-4">Loading leaderboard...</div>;
  }

  return (
    <div className="bg-gaming-surface rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Competition Leaderboard</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="py-2">#</th>
            <th className="py-2">Bot</th>
            <th className="py-2">Strategy</th>
            <th className="py-2">Trades</th>
            <th className="py-2">Win Rate</th>
            <th className="py-2">P&L</th>
            <th className="py-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.bot_id} className="border-b border-gray-800">
              <td className="py-2 text-center">{entry.rank}</td>
              <td className="py-2">{entry.bot_name}</td>
              <td className="py-2">{entry.strategy}</td>
              <td className="py-2 text-center">{entry.trades}</td>
              <td className="py-2 text-center">{(entry.win_rate * 100).toFixed(1)}%</td>
              <td className={`py-2 text-center ${entry.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(2)}
              </td>
              <td className="py-2 text-center font-bold">${entry.balance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Add to bots page**

Import in `frontend/src/app/bots/page.tsx` and add `<BotLeaderboard />` component.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/bot-leaderboard.tsx
git commit -m "feat(frontend): add bot leaderboard component"
```

---

## Phase 3 Tasks

### Task 9: Create Backtest Runner

**Files:**
- Create: `backend/src/bin/backtest_runner.rs`

- [ ] **Step 1: Create backtest_runner binary**

```rust
//! Backtest Runner - Tests strategies on historical data
//!
//! Usage: cargo run --bin backtest_runner -- --data data/sse_logs.csv

use std::fs::File;
use std::io::{BufRead, BufReader};
use clap::Parser;

#[derive(Debug, Clone)]
struct MarketTick {
    timestamp: i64,
    btc_price: f64,
    start_price: f64,
    yes_price: f64,
    no_price: f64,
    time_remaining: i64,
}

#[derive(Debug)]
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

fn main() {
    let args = Args::parse();
    
    println!("Backtest Runner starting...");
    println!("Data file: {}", args.data);
    
    // Load historical data
    let file = File::open(&args.data).expect("Failed to open data file");
    let reader = BufReader::new(file);
    
    let mut ticks: Vec<MarketTick> = Vec::new();
    for line in reader.lines().skip(1) { // Skip header
        if let Ok(line) = line {
            // Parse CSV: timestamp,btc_price,start_price,yes_price,no_price,time_remaining
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 6 {
                ticks.push(MarketTick {
                    timestamp: parts[0].parse().unwrap_or(0),
                    btc_price: parts[1].parse().unwrap_or(0.0),
                    start_price: parts[2].parse().unwrap_or(0.0),
                    yes_price: parts[3].parse().unwrap_or(0.5),
                    no_price: parts[4].parse().unwrap_or(0.5),
                    time_remaining: parts[5].parse().unwrap_or(0),
                });
            }
        }
    }
    
    println!("Loaded {} ticks", ticks.len());
    
    // Run backtest simulation (placeholder - implement strategy evaluation)
    let result = BacktestResult {
        strategy_name: "momentum".to_string(),
        total_trades: 0,
        wins: 0,
        losses: 0,
        win_rate: 0.0,
        final_balance: 10.0,
        roi_pct: 0.0,
        max_drawdown: 0.0,
    };
    
    println!("\n=== Backtest Results ===");
    println!("Strategy: {}", result.strategy_name);
    println!("Total Trades: {}", result.total_trades);
    println!("Win Rate: {:.1}%", result.win_rate * 100.0);
    println!("Final Balance: ${:.2}", result.final_balance);
    println!("ROI: {:.1}%", result.roi_pct);
}

#[derive(Parser, Debug)]
struct Args {
    #[arg(short, long)]
    data: String,
}
```

- [ ] **Step 2: Add to Cargo.toml**

Add to `backend/Cargo.toml`:
```toml
[[bin]]
name = "backtest_runner"
path = "src/bin/backtest_runner.rs"
```

- [ ] **Step 3: Run build**

Run: `cd backend && cargo build --bin backtest_runner`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add backend/src/bin/backtest_runner.rs backend/Cargo.toml
git commit -m "feat(backtest): add backtest runner binary"
```

---

## Validation Checklist

After all tasks:

- [ ] Phase 1: All strategy tests pass with edge calculation
- [ ] Phase 2: 15 bots can run in competition mode
- [ ] Phase 3: Backtest runner compiles and runs on sample data
- [ ] Frontend leaderboard displays bot rankings
- [ ] Build passes: `cargo build --release` in backend
- [ ] Frontend builds: `bun run build` in frontend

---

## Dependencies

- Rust 1.70+
- tokio, serde, clap crates
- chrono for timestamp handling

---

## Execution Options

**Option 1: Subagent-Driven (recommended)**
I dispatch a fresh subagent per task with two-stage review between tasks.

**Option 2: Inline Execution**
Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?