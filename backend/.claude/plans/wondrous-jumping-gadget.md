# Polymarket V2 Backend - Bot Orchestrator & Trading System Plan

## Context

The polymarket-demo frontend project has a complete bot trading system with:
- Bot configurations, strategies, and parameters
- Competition/session management
- Portfolio tracking per bot
- SQLite storage for sessions, positions, trades

The v2 backend needs to replicate this functionality as a Rust/Axum backend API, enabling:
- Multiple bots running simultaneously per user
- Strategy execution with market data
- Session tracking with performance metrics
- Data storage for analysis and history

## API Data Sources Analysis

### Data FROM Polymarket API (no storage needed)
| Data | API Endpoint | Notes |
|------|--------------|-------|
| Market info | Gamma API `/events/slug/{slug}` | Active markets, prices, tokens |
| Current price | CLOB `/midpoint`, `/book` | Real-time YES/NO prices |
| User balance | Data API `/balance` | USDC balance |
| Live positions | CLOB `/positions` | User's open positions |
| Order history | CLOB `/orders` | User's order history |

### Data WE MUST STORE (not available from API)
| Data | Reason | Table |
|------|--------|-------|
| Bot configurations | User-defined settings | `bot_configs` ✓ exists |
| Bot sessions | Performance tracking per session | Need new table |
| Trade decisions | Why bot made each trade (analysis) | Need new table |
| Strategy performance | Win rate, PnL per bot | Need new table |
| Market transitions | Which market bot traded on | Link to orders |

### Data WE CALCULATE (derived)
| Data | Calculation |
|------|-------------|
| Win rate | wins / total_trades |
| P&L per position | (exit_price - entry_price) * size |
| Sharpe ratio | From session PnL history |
| Max drawdown | Peak to trough balance |

## Current v2 Backend Status

### Already Implemented ✓
- User authentication (JWT)
- Settings/credentials storage (encrypted)
- Market discovery (`/api/market/active`)
- Order placement (`/api/orders/place`)
- Bot config CRUD (`/api/bots/*`)
- Activity log

### Partially Implemented (stubbed/unused)
- `BotExecutor` - skeleton only
- `StrategyExecutor` - basic strategies
- Position tracking - table exists but unused

### Missing (need to implement)
- Session management (run duration, balance tracking)
- Portfolio per bot
- Bot orchestrator (multiple bots per user)
- Performance metrics calculation
- Market transition handling
- SSE/websocket for real-time updates

## Implementation Plan

### Phase 1: Database Schema Extensions

**Files to modify:**
- `/src/db/mod.rs` - Add new tables

**New tables:**
```sql
-- Bot sessions (tracking run periods)
CREATE TABLE bot_sessions (
    id INTEGER PRIMARY KEY,
    bot_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    start_balance REAL NOT NULL,
    end_balance REAL,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    total_pnl REAL DEFAULT 0,
    status TEXT DEFAULT 'running',
    max_drawdown REAL DEFAULT 0,
    FOREIGN KEY (bot_id) REFERENCES bot_configs(id)
);

-- Trade decisions (why bot traded)
CREATE TABLE trade_decisions (
    id INTEGER PRIMARY KEY,
    bot_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    market_id TEXT NOT NULL,
    condition_id TEXT NOT NULL,
    outcome TEXT NOT NULL, -- YES/NO
    signal_confidence REAL NOT NULL,
    btc_price REAL,
    btc_change REAL,
    market_yes_price REAL,
    market_no_price REAL,
    time_remaining INTEGER,
    decision_reason TEXT,
    executed INTEGER DEFAULT 0, -- 0 = not executed, 1 = executed
    order_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (bot_id) REFERENCES bot_configs(id),
    FOREIGN KEY (session_id) REFERENCES bot_sessions(id)
);

-- Bot portfolio state (current holdings per bot)
CREATE TABLE bot_portfolios (
    bot_id INTEGER PRIMARY KEY,
    balance REAL DEFAULT 0,
    initial_balance REAL DEFAULT 100,
    open_positions INTEGER DEFAULT 0,
    total_pnl REAL DEFAULT 0,
    last_trade_time TEXT,
    updated_at TEXT,
    FOREIGN KEY (bot_id) REFERENCES bot_configs(id)
);
```

### Phase 2: Bot Orchestrator Module

**New files:**
- `/src/trading/orchestrator.rs` - Main orchestrator
- `/src/trading/session.rs` - Session management

**Key components:**

1. **BotOrchestrator** - Manages multiple bots:
   - Start/stop bots per user
   - Track active sessions
   - Coordinate market data fetching
   - Handle bot events (trade, error, settlement)

2. **BotSession** - Per-run tracking:
   - Start/end timestamps
   - Balance tracking
   - Trade count
   - Win/loss tracking
   - Auto-save every 30s

### Phase 3: Strategy Enhancement

**Files to modify:**
- `/src/trading/bot_executor/strategies.rs`

**Enhancements:**
- Add market context (time remaining, yes/no prices)
- Add BTC velocity/acceleration calculation
- Implement strategies from demo project:
  - window_delta
  - fair_value
  - last_seconds_scalp
  - binance_velocity

### Phase 4: API Endpoints for Bot Control

**Files to modify:**
- `/src/api/bots.rs`
- `/src/api/mod.rs`

**New endpoints:**
```
POST /api/bots/:id/session/start - Start trading session
POST /api/bots/:id/session/stop - Stop session
GET  /api/bots/:id/session - Current session status
GET  /api/bots/:id/portfolio - Bot portfolio state
GET  /api/bots/:id/history - Historical sessions
GET  /api/bots/:id/trades - Trade history with decisions
POST /api/bots/run-all - Start all bots
POST /api/bots/stop-all - Stop all bots
GET  /api/portfolio - Aggregate user portfolio
```

### Phase 5: Real-time Updates

**New files:**
- `/src/api/sse.rs` - Server-sent events

**Events broadcast:**
- Market transitions (new 5min window)
- Bot trade decisions
- Position settlements
- Balance updates
- Session completions

### Phase 6: Performance Tracking

**Files to modify:**
- `/src/trading/session.rs`

**Metrics calculated:**
- Win rate = wins / total_trades
- PnL per trade
- Max drawdown = max(peak_balance - current_balance)
- Sharpe ratio (simplified)

## Verification Plan

### Step 1: Database migration
```bash
# Rebuild backend
cargo build --release
./target/release/polymarket-v2

# Verify tables exist
sqlite3 data/polymarket_v2.db ".schema bot_sessions"
sqlite3 data/polymarket_v2.db ".schema trade_decisions"
```

### Step 2: API endpoint testing
```bash
# Start bot session
curl -X POST http://localhost:3001/api/bots/1/session/start \
  -H "Authorization: Bearer $TOKEN"

# Get session status
curl http://localhost:3001/api/bots/1/session \
  -H "Authorization: Bearer $TOKEN"

# Get portfolio
curl http://localhost:3001/api/bots/1/portfolio \
  -H "Authorization: Bearer $TOKEN"
```

### Step 3: Multi-bot test
```bash
# Create multiple bots
curl -X POST http://localhost:3001/api/bots \
  -d '{"name":"WindowDelta","strategy":"window_delta","market_id":"btc-5"}'

curl -X POST http://localhost:3001/api/bots \
  -d '{"name":"FairValue","strategy":"fair_value","market_id":"btc-5"}'

# Start all
curl -X POST http://localhost:3001/api/bots/run-all

# Check status
curl http://localhost:3001/api/portfolio
```

## Implementation Order

1. **Database schema** - Add new tables
2. **Bot portfolio tracking** - Balance, positions per bot
3. **Session management** - Start/stop, metrics
4. **Orchestrator** - Multiple bots coordination
5. **Enhanced strategies** - Market context, more strategies
6. **API endpoints** - Session control, portfolio
7. **SSE broadcasts** - Real-time updates
8. **Performance metrics** - Win rate, drawdown, sharpe

## Key Differences from Demo Project

| Aspect | Demo (TypeScript) | V2 (Rust) |
|--------|-------------------|-----------|
| Bot config | In-memory + SQLite | SQLite only |
| Portfolio | In-memory Map | SQLite + in-memory cache |
| Sessions | Auto-save 30s | Auto-save 30s (same) |
| Strategies | 20+ strategies | ~10 strategies initially |
| SSE | Bun native | Axum SSE |
| Market engine | Central singleton | API endpoints |

## Data Flow

```
User Request → API → Orchestrator → BotExecutor → Strategy
                              ↓
                         Market API (Gamma/CLOB)
                              ↓
                         Decision (trade/no trade)
                              ↓
                         Order (if trade) → Polymarket CLOB
                              ↓
                         Session/Portfolio Update → SQLite
                              ↓
                         SSE Broadcast → Frontend
```