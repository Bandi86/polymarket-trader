# Polymarket Trader

A trading bot system for Polymarket with Rust backend and Next.js frontend.

## Features

- **Multiple Trading Strategies**: Momentum, Mean Reversion, Trend Following, Contrarian, Volatility, Oracle Lag, Fair Value, Sniper, Window Delta, Binance Velocity
- **Real-time Dashboard**: Live positions, bot status, trading logs
- **Bot Management**: Create, configure, start/stop trading bots
- **Market Analysis**: Price monitoring, order books, market data
- **Order Management**: Place, track, and manage trades
- **User Authentication**: Secure login with JWT tokens
- **Encrypted Credentials**: Polymarket API keys stored encrypted in database

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │Dashboard│ │  Bots   │ │ Markets │ │ Orders  │    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                      │                               │
│              SSE (Real-time updates)                 │
└──────────────────────┼──────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────┐
│                 Backend (Rust)                       │
│  ┌───────────────────────────────────────────────┐  │
│  │              API Layer (Axum)                  │  │
│  │  auth │ bots │ market │ orders │ settings │ sse│  │
│  └───────────────────────────────────────────────┘  │
│                      │                               │
│  ┌───────────────────────────────────────────────┐  │
│  │           Trading Engine                       │  │
│  │  PolymarketClient │ BotExecutor │ Strategies  │  │
│  └───────────────────────────────────────────────┘  │
│                      │                               │
│  ┌───────────────────────────────────────────────┐  │
│  │           Database (SQLite)                    │  │
│  │  users │ bot_configs │ bot_sessions │ trades  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Bun |
| Backend | Rust, Axum, SQLite, Tokio |
| Auth | JWT, bcrypt password hashing |
| Real-time | Server-Sent Events (SSE) |
| Crypto | AES-256-GCM for credential encryption |

## Quick Start

### Prerequisites

- **Rust** 1.70+ (`rustc --version`)
- **Bun** 1.0+ (`bun --version`)
- **Polymarket API credentials** (from [Polymarket](https://polymarket.com))

### Setup

```bash
# Clone the repository
git clone https://github.com/Bandi86/polymarket-trader.git
cd polymarket-trader

# Create environment file
cp .env.example .env

# Edit .env and set JWT_SECRET (use: openssl rand -base64 32)
nano .env

# Install frontend dependencies
cd frontend && bun install && cd ..

# Create database directory
mkdir -p backend/data
```

### Run Development Servers

```bash
# Option 1: Run both servers together
./dev.sh

# Option 2: Run separately
cd backend && cargo run --release
cd frontend && bun run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000

### First Time Setup

1. Open http://localhost:3000
2. Click **Register** to create an account
3. Login with your credentials
4. Go to **Settings** → Add your Polymarket API Key and Private Key
5. Go to **Bots** → Create a trading bot with your chosen strategy
6. Start the bot and monitor on **Dashboard**

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new user |
| `/api/auth/login` | POST | Login, get JWT token |
| `/api/bots` | GET/POST | List/create bots |
| `/api/bots/:id/start` | POST | Start bot trading |
| `/api/bots/:id/stop` | POST | Stop bot |
| `/api/markets` | GET | List available markets |
| `/api/orders` | POST | Place order |
| `/api/settings` | GET/PUT | Manage API credentials |
| `/api/sse` | GET | Real-time event stream |

## Trading Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| **Momentum** | Follow price momentum direction | Trending markets |
| **Mean Reversion** | Bet on price returning to average | Volatile markets |
| **Trend Following** | Follow established trends | Long-term positions |
| **Contrarian** | Bet against crowd sentiment | Overreaction scenarios |
| **Volatility** | Trade based on volatility spikes | Uncertain events |
| **Oracle Lag** | Exploit price delays vs oracle | Prediction markets |
| **Fair Value** | Trade when price deviates from fair value | Mispriced markets |
| **Sniper** | Quick execution on opportunities | Fast-moving markets |
| **Window Delta** | Time-window based decisions | Scheduled events |
| **Binance Velocity** | Correlate with Binance momentum | Crypto-related markets |

## Project Structure

```
polymarket-trader/
├── backend/
│   ├── src/
│   │   ├── api/           # REST API handlers
│   │   ├── crypto/        # Encryption utilities
│   │   ├── db/            # Database queries
│   │   ├── middleware/    # Auth middleware
│   │   ├── strategies/    # Trading strategies
│   │   ├── trading/       # Polymarket client, bot executor
│   │   └── main.rs        # Entry point
│   ├── Cargo.toml
│   └── data/              # SQLite database
│
├── frontend/
│   ├── app/               # Next.js pages
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # API hooks, SSE
│   │   ├── store/         # State management
│   │   ├── types/         # TypeScript types
│   │   └── lib/           # Utilities
│   ├── package.json
│   └── bun.lock
│
├── docs/                  # Documentation
├── .env.example           # Environment template
├── dev.sh                 # Development runner
└── README.md
```

## Security

- **Credentials encrypted**: Polymarket API keys stored with AES-256-GCM
- **JWT authentication**: Session tokens with 24h expiry
- **Password hashing**: bcrypt with cost factor 12
- **No secrets in code**: All credentials via environment or UI

## License

MIT

## Contributing

PRs welcome. Please run tests before submitting:

```bash
cd backend && cargo test
cd frontend && bun test
```