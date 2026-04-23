// API Types matching Rust backend

export interface User {
  id: number;
  email: string;
  username: string;
  created_at: string;
}

export interface Bot {
  id: number;
  name: string;
  strategy: StrategyType;
  enabled: boolean;
  bet_size: number;
  max_bet: number;
  use_kelly: boolean;
  kelly_fraction: number;
  interval_seconds: number;
  volatility_threshold?: number;
  btc_confirmation?: boolean;
  entry_bounds?: number[];
  status: BotStatus;
  run_time?: number;
  created_at: string;
}

export type StrategyType =
  | "random"
  | "momentum"
  | "mean_reversion"
  | "trend"
  | "fair_value"
  | "window_delta"
  | "binance_signal"
  | "last_seconds_scalp";

export type BotStatus = "idle" | "running" | "stopped" | "error";

export interface BotSession {
  id: number;
  bot_id: number;
  start_time: number;
  end_time?: number;
  start_balance: number;
  end_balance?: number;
  total_trades: number;
  winning_trades: number;
  status: "active" | "completed" | "stopped";
}

export interface BotStats {
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  win_rate: number;
  ev: number;
  sharpe?: number;
}

export interface Portfolio {
  balance: number;
  usdc_balance?: number;
  matic_balance?: number;
  positions: Position[];
  closed_positions: Position[];
}

export interface Position {
  id: number;
  market_id: string;
  outcome: "YES" | "NO";
  amount: number;
  odds: number;
  stake: number;
  fee: number;
  timestamp: number;
  status: "open" | "closed" | "settled";
  pnl?: number;
  bot_id?: number;
}

export interface Order {
  id: string;
  market_id: string;
  outcome: "YES" | "NO";
  side: "BUY" | "SELL";
  price: number;
  size: number;
  status: "PENDING" | "FILLED" | "CANCELLED";
  created_at: number;
  filled_at?: number;
  bot_id?: number;
}

export interface Market {
  id: string;
  question: string;
  outcomes: ["YES", "NO"];
  outcome_prices: [number, number];
  volume: number;
  active: boolean;
  expires_at?: number;
}

export interface Settings {
  polymarket_api_key?: string;
  polymarket_api_secret?: string;
  polymarket_api_passphrase?: string;
  binance_api_key?: string;
  binance_api_secret?: string;
  daily_loss_limit?: number;
  emergency_stop_enabled?: boolean;
  has_credentials?: boolean;
  wallet_address?: string;
  balance?: string;
}

export interface SystemStatus {
  bots_running: number;
  bots_total: number;
  total_pnl: number;
  active_positions: number;
  binance_connected: boolean;
  last_update: number;
}

// SSE Event Types
export interface SSEEvent {
  type: "connected" | "market" | "bot" | "bot_log" | "position" | "status";
  data: unknown;
}

export interface BotLogEvent {
  bot_id: number;
  bot_name: string;
  message: string;
  timestamp: number;
  level: "info" | "warn" | "error" | "success";
}

export interface MarketUpdateEvent {
  btc_price: number;
  beat_price: number;
  current_market?: Market;
  time_remaining?: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CreateBotRequest {
  name: string;
  strategy: StrategyType;
  bet_size: number;
  max_bet?: number;
  use_kelly?: boolean;
  kelly_fraction?: number;
  interval_seconds?: number;
  volatility_threshold?: number;
  btc_confirmation?: boolean;
}

export interface PlaceOrderRequest {
  market_id: string;
  outcome: "YES" | "NO";
  side: "BUY" | "SELL";
  price: number;
  size: number;
  bot_id?: number;
}
