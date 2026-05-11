import { getStrategyColor } from "./utils";

const STRATEGY_NAMES: Record<string, string> = {
  momentum: "Momentum",
  mean_reversion: "Mean Rev",
  last_seconds_scalp: "LSS",
  binance_signal: "Binance Sig",
  contrarian: "Contrarian",
  smart_trend: "Smart Trend",
};

export function getStrategyName(s: string): string {
  return STRATEGY_NAMES[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

export { getStrategyColor };