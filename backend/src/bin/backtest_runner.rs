//! Backtest Engine - Tests strategies on historical market data
//!
//! Run with: cargo run --bin backtest_runner -- --strategy edge_hunter_v2 --data data/market_history.csv
//!
//! Expected CSV format (from Polymarket SSE logs):
//! timestamp,btc_price,start_price,yes_price,no_price,time_remaining
//! 1714190400,80123.50,80120.00,0.52,0.48,285
//! 1714190430,80125.00,80120.00,0.53,0.47,255
//! ...

use clap::Parser;
use std::collections::VecDeque;
use std::fs::File;
use std::io::{BufRead, BufReader, Write};

use polymarket_v2_backend::trading::bot_executor::strategies::{Signal, StrategyContext, StrategyExecutor};

#[derive(Debug, Clone)]
struct MarketTick {
    timestamp: i64,
    btc_price: f64,
    start_price: f64,    // BTC price when market opened
    yes_price: f64,
    no_price: f64,
    time_remaining: i64, // seconds until market closes
}

#[derive(Debug, serde::Serialize)]
struct BacktestTrade {
    timestamp: i64,
    entry_price: f64,
    exit_price: f64,
    side: String,       // "YES" or "NO"
    outcome: String,    // "WIN" or "LOSS"
    pnl: f64,
    confidence: f64,
    reason: String,
}

#[derive(Debug, serde::Serialize)]
struct BacktestResult {
    strategy_name: String,
    total_trades: u32,
    wins: u32,
    losses: u32,
    win_rate: f64,
    initial_balance: f64,
    final_balance: f64,
    roi_pct: f64,
    max_drawdown_pct: f64,
    avg_pnl_per_trade: f64,
    largest_win: f64,
    largest_loss: f64,
    trades: Vec<BacktestTrade>,
}

impl BacktestResult {
    fn new(strategy_name: String, initial_balance: f64) -> Self {
        Self {
            strategy_name,
            total_trades: 0,
            wins: 0,
            losses: 0,
            win_rate: 0.0,
            initial_balance,
            final_balance: initial_balance,
            roi_pct: 0.0,
            max_drawdown_pct: 0.0,
            avg_pnl_per_trade: 0.0,
            largest_win: 0.0,
            largest_loss: 0.0,
            trades: Vec::new(),
        }
    }

    fn add_trade(&mut self, trade: BacktestTrade) {
        if trade.outcome == "WIN" {
            self.wins += 1;
            if trade.pnl > self.largest_win {
                self.largest_win = trade.pnl;
            }
        } else {
            self.losses += 1;
            if trade.pnl < self.largest_loss {
                self.largest_loss = trade.pnl;
            }
        }
        self.total_trades += 1;
        self.final_balance += trade.pnl;
    }

    fn finalize(&mut self) {
        if self.total_trades > 0 {
            self.win_rate = self.wins as f64 / self.total_trades as f64;
            self.avg_pnl_per_trade = (self.final_balance - self.initial_balance) / self.total_trades as f64;
        }
        self.roi_pct = ((self.final_balance - self.initial_balance) / self.initial_balance) * 100.0;

        // Calculate max drawdown from trades
        let mut peak = self.initial_balance;
        let mut max_dd = 0.0;
        let mut balance = self.initial_balance;
        for trade in &self.trades {
            balance += trade.pnl;
            if balance > peak {
                peak = balance;
            }
            let dd = (peak - balance) / peak;
            if dd > max_dd {
                max_dd = dd;
            }
        }
        self.max_drawdown_pct = max_dd * 100.0;
    }

    fn print_summary(&self) {
        println!("\n╔══════════════════════════════════════════════════════╗");
        println!("║             BACKTEST RESULTS: {:24} ║", self.strategy_name);
        println!("╠══════════════════════════════════════════════════════╣");
        println!("║  Total Trades:     {:4}                               ║", self.total_trades);
        println!("║  Wins / Losses:   {:4} / {:4}                          ║", self.wins, self.losses);
        println!("║  Win Rate:        {:.1}%                              ║", self.win_rate * 100.0);
        println!("║  Initial Balance: ${:.2}                           ║", self.initial_balance);
        println!("║  Final Balance:    ${:.2}                           ║", self.final_balance);
        println!("║  ROI:              {:.2}%                             ║", self.roi_pct);
        println!("║  Max Drawdown:     {:.2}%                             ║", self.max_drawdown_pct);
        println!("║  Avg P&L/Trade:    ${:.4}                           ║", self.avg_pnl_per_trade);
        println!("║  Largest Win:      ${:.4}                           ║", self.largest_win);
        println!("║  Largest Loss:     ${:.4}                           ║", self.largest_loss);
        println!("╚══════════════════════════════════════════════════════╝");
    }

    fn print_trade_log(&self, limit: usize) {
        println!("\n--- Last {} Trades ---", limit.min(self.trades.len()));
        println!(
            "{:<12} {:<6} {:<8} {:<8} {:<8} {:<8} Reason",
            "Time", "Side", "Entry", "Exit", "P&L", "Conf%"
        );
        println!("{}", "-".repeat(70));

        let start = if self.trades.len() > limit {
            self.trades.len() - limit
        } else {
            0
        };

        for trade in &self.trades[start..] {
            let pnl_str = if trade.pnl >= 0.0 {
                format!("+${:.4}", trade.pnl)
            } else {
                format!("${:.4}", trade.pnl)
            };
            println!("{:<12} {:<6} {:<8.4} {:<8.4} {:<8} {:.0}% {}",
                trade.timestamp, trade.side, trade.entry_price, trade.exit_price,
                pnl_str, trade.confidence * 100.0, trade.reason);
        }
    }
}

struct BacktestEngine {
    strategy: StrategyExecutor,
    strategy_name: String,
    bet_size: f64,
    initial_balance: f64,
}

impl BacktestEngine {
    fn new(strategy_type: &str, params: &str, bet_size: f64, initial_balance: f64) -> Self {
        Self {
            strategy: StrategyExecutor::new(strategy_type, params),
            strategy_name: strategy_type.to_string(),
            bet_size,
            initial_balance,
        }
    }

    fn run(&self, ticks: &[MarketTick]) -> BacktestResult {
        let mut result = BacktestResult::new(self.strategy_name.clone(), self.initial_balance);
        let mut balance = self.initial_balance;
        let mut current_trade: Option<CurrentTrade> = None;
        let mut price_history: VecDeque<(f64, std::time::Instant)> = VecDeque::new();
        let mut last_market_start: Option<f64> = None;
        let mut market_settled = false;

        for (i, tick) in ticks.iter().enumerate() {
            // Detect market transition (new market or market closed)
            let market_transition = last_market_start != Some(tick.start_price);
            if market_transition {
                // New market - settle any pending trade at previous market's closing price
                if let Some(trade) = current_trade.take() {
                    // Use last tick's price as settlement price for previous market
                    let settle_price = if i > 0 { ticks[i - 1].btc_price } else { tick.btc_price };
                    let diff = (settle_price - trade.entry_price) / trade.entry_price;
                    let won = if trade.side == "YES" { diff > 0.0 } else { diff < 0.0 };

                    let pnl = if won {
                        if trade.side == "YES" {
                            self.bet_size * (1.0 - trade.entry_price)
                        } else {
                            self.bet_size * trade.entry_price
                        }
                    } else {
                        -self.bet_size
                    };

                    result.add_trade(BacktestTrade {
                        timestamp: ticks[i - 1].timestamp,
                        entry_price: trade.entry_price,
                        exit_price: settle_price,
                        side: trade.side,
                        outcome: if won { "WIN" } else { "LOSS" }.to_string(),
                        pnl,
                        confidence: trade.confidence,
                        reason: trade.reason,
                    });
                    balance += pnl;
                }

                // Reset for new market
                price_history.clear();
                last_market_start = Some(tick.start_price);
                market_settled = false;
            }

            // Update price history for velocity calculation (30-second rolling window)
            let now = std::time::Instant::now();
            price_history.push_back((tick.btc_price, now));
            let cutoff = now - std::time::Duration::from_secs(30);
            price_history.retain(|(_, t)| *t > cutoff);

            // Calculate velocity and acceleration
            let (velocity, acceleration, window_open) = if price_history.len() >= 2 {
                let oldest = price_history.front().map(|(p, _)| *p).unwrap_or(tick.btc_price);
                let latest = price_history.back().map(|(p, _)| *p).unwrap_or(tick.btc_price);
                let duration_secs = price_history.back()
                    .map(|(_, t)| t.elapsed().as_secs_f64())
                    .unwrap_or(1.0).max(0.1);

                let delta = (latest - oldest) / oldest;
                let vel = delta / duration_secs;

                let accel = if price_history.len() >= 3 {
                    let mid_idx = price_history.len() / 2;
                    let mid_price = price_history[mid_idx].0;
                    let mid_duration = duration_secs / 2.0;
                    let prev_delta = (mid_price - oldest) / oldest;
                    let prev_vel = prev_delta / mid_duration.max(0.1);
                    (vel - prev_vel) / mid_duration.max(0.1)
                } else {
                    0.0
                };

                (Some(vel), Some(accel), Some(oldest))
            } else {
                (None, None, None)
            };

            // Build strategy context
            let btc_change = if price_history.len() >= 2 {
                let oldest = price_history.front().map(|(p, _)| *p).unwrap_or(tick.btc_price);
                Some((tick.btc_price - oldest) / oldest)
            } else {
                None
            };

            let ctx = StrategyContext {
                btc_price: tick.btc_price,
                btc_change,
                btc_window_open: window_open.or(Some(tick.start_price)),
                yes_price: tick.yes_price,
                no_price: tick.no_price,
                time_remaining: tick.time_remaining,
                btc_velocity: velocity,
                btc_acceleration: acceleration,
                btc_volatility: acceleration.map(|a| a.abs()),
            };

            // Only evaluate strategy if we don't have a position AND market hasn't settled
            if current_trade.is_none() && !market_settled && balance >= self.bet_size {
                let signal = self.strategy.evaluate_with_context(ctx);

                match signal {
                    Signal::Yes(confidence) | Signal::No(confidence) => {
                        let (side, price) = match signal {
                            Signal::Yes(_) => ("YES", tick.yes_price),
                            Signal::No(_) => ("NO", tick.no_price),
                            Signal::Hold(_) => unreachable!(),
                        };

                        // Check price limits (30-70c range)
                        if (0.30..=0.70).contains(&price) {
                            current_trade = Some(CurrentTrade {
                                entry_price: price,
                                side: side.to_string(),
                                confidence,
                                reason: format!("{} signal @ {:.2}c", side, price * 100.0),
                            });
                        }
                    }
                    Signal::Hold(_) => {}
                }
            }
        }

        result.finalize();
        result
    }
}

struct CurrentTrade {
    entry_price: f64,
    side: String,
    confidence: f64,
    reason: String,
}

fn load_ticks_from_csv(path: &str) -> Result<Vec<MarketTick>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open {}: {}", path, e))?;
    let reader = BufReader::new(file);

    let mut ticks = Vec::new();
    let mut header_skipped = false;

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;

        // Skip header
        if !header_skipped && (line.contains("timestamp") || line.contains("btc_price")) {
            header_skipped = true;
            continue;
        }
        if line.trim().is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 6 {
            ticks.push(MarketTick {
                timestamp: parts[0].trim().parse().unwrap_or(0),
                btc_price: parts[1].trim().parse().unwrap_or(0.0),
                start_price: parts[2].trim().parse().unwrap_or(0.0),
                yes_price: parts[3].trim().parse().unwrap_or(0.5),
                no_price: parts[4].trim().parse().unwrap_or(0.5),
                time_remaining: parts[5].trim().parse().unwrap_or(0),
            });
        }
    }

    if ticks.is_empty() {
        return Err("No ticks loaded - check CSV format".to_string());
    }

    Ok(ticks)
}

fn generate_sample_data(output_path: &str, num_markets: usize) -> Result<(), String> {
    // Generate realistic sample data for testing
    let mut file = File::create(output_path)
        .map_err(|e| format!("Failed to create {}: {}", output_path, e))?;

    writeln!(file, "timestamp,btc_price,start_price,yes_price,no_price,time_remaining").map_err(|e| e.to_string())?;

    let base_price = 80000.0_f64;
    let market_duration = 300_i64; // 5 minutes

    for market_idx in 0..num_markets {
        let market_start = 1714190400 + (market_idx as i64 * 300); // 5 min intervals
        let start_price = base_price + (rand_simple(market_idx as i64) - 0.5) * 500.0;
        let mut current_price = start_price;

        // Each market has a random "bias" - tendency to go up or down
        let market_bias = (rand_simple(market_idx as i64 * 7) - 0.5) * 0.001;

        for second in 0..300 {
            let timestamp = market_start + second;
            let time_remaining = market_duration - second;

            // Realistic BTC price movement: random walk with momentum persistence
            // Use previous price to create trend persistence
            let momentum = if second > 0 {
                (current_price - start_price) / start_price * 0.3
            } else {
                0.0
            };
            let random_walk = (rand_simple(timestamp) - 0.5) * 30.0; // ~$30 volatility per tick
            let drift = market_bias * 30.0; // Small consistent drift
            current_price += random_walk + momentum + drift;

            // Calculate yes/no prices (around 50c with spread)
            // Fair price based on how far current is from start
            let delta_pct = (current_price - start_price) / start_price;
            let fair_price = 0.5 + delta_pct * 5.0; // 0.1% BTC move = 0.5% price move

            // Polymarket has ~2% normal spread built into YES+NO combined price
            // Normal combined: $1.02 to $1.04
            // Arb opportunity: combined < $0.98 (spread unusually tight)
            // ~20% of time we get tighter spreads creating arb opportunities
            let r = rand_simple(market_idx as i64 * 17 + second);
            let target_combined = if r < 0.20 { 0.96 + r * 0.02 } else { 1.02 + r * 0.02 };
            // Arb: 0.96-0.98 (~20%), Normal: 1.02-1.04 (~80%)
            let yes_price = fair_price.clamp(0.30, 0.70);
            let capped_no = (target_combined - yes_price).clamp(0.30, 0.98);

            writeln!(file, "{},{:.2},{:.2},{:.4},{:.4},{}",
                timestamp, current_price, start_price, yes_price, capped_no, time_remaining
            ).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

// Simple pseudo-random for deterministic data generation
fn rand_simple(seed: i64) -> f64 {
    let divisor = (1_i64 << 31) as f64;
    let x = ((seed * 1103515245 + 12345) % (1_i64 << 31)) as f64;
    (x / divisor).fract()
}

#[derive(Parser, Debug)]
#[command(name = "backtest")]
struct Args {
    #[arg(short, long, default_value = "edge_hunter_v2")]
    strategy: String,

    #[arg(short, long, default_value = "data/market_history.csv")]
    data: String,

    #[arg(short, long, default_value = "1.0")]
    bet_size: f64,

    #[arg(short, long, default_value = "10.0")]
    initial_balance: f64,

    #[arg(short, long, default_value = "20")]
    trade_log_limit: usize,

    #[arg(long)]
    generate_sample: Option<usize>,
}

fn main() {
    let args = Args::parse();

    // Generate sample data if requested
    if let Some(num_markets) = args.generate_sample {
        let path = format!("data/backtest_sample_{}.csv", num_markets);
        match generate_sample_data(&path, num_markets) {
            Ok(_) => {
                println!("Generated {} markets of sample data to {}", num_markets, path);
                println!("Run backtest with: cargo run --bin backtest_runner -- --strategy {} --data {}", args.strategy, path);
                return;
            }
            Err(e) => {
                eprintln!("Failed to generate sample data: {}", e);
                return;
            }
        }
    }

    // Load market data
    println!("Loading market data from {}...", args.data);
    let ticks = match load_ticks_from_csv(&args.data) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Failed to load data: {}", e);
            eprintln!("\nTo generate sample data, run:");
            eprintln!("  cargo run --bin backtest_runner -- --generate-sample 10");
            return;
        }
    };
    println!("Loaded {} market ticks ({} markets, {} minutes)",
        ticks.len(), ticks.len() / 300, ticks.len() / 300 / 60);

    // Create backtest engine
    let engine = BacktestEngine::new(&args.strategy, "{}", args.bet_size, args.initial_balance);

    // Run backtest
    println!("\nRunning backtest for strategy: {}...", args.strategy);
    let result = engine.run(&ticks);

    // Print results
    result.print_summary();
    if result.total_trades > 0 {
        result.print_trade_log(args.trade_log_limit);
    }

    // Write results to JSON
    let results_path = format!("data/backtest_results_{}.json", args.strategy);
    if let Ok(mut file) = File::create(&results_path) {
        let json = serde_json::to_string_pretty(&result).unwrap_or_default();
        let _ = file.write_all(json.as_bytes());
        println!("\nResults saved to {}", results_path);
    }
}
