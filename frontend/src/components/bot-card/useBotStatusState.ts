import { AlertCircle, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BotData } from "@/hooks/useTradingData";
import { getStrategyColor, getStrategyName } from "@/lib/design-tokens";
import type { Position } from "@/types";

interface UseBotStatusStateProps {
  bot: BotData;
  yesPrice: number;
  positions: Position[];
}

interface HealthStatus {
  status: string;
  color: string;
  icon: typeof TrendingUp;
  label: string;
}

interface Streak {
  type: "win" | "loss" | "none";
  count: number;
}

export interface BotStatusState {
  // Timer
  runningTime: number;

  // Strategy
  strategyColor: string;
  strategyName: string;

  // Positions
  botPositions: Position[];
  positionsValue: number;
  unrealizedPnl: number;

  // Closed positions
  closedPositions: Position[];
  recentTrades: number[];
  lastTradePnl: number;
  initialBalance: number;
  balanceGrowth: number;
  growthPercent: number;
  equityCurvePlot: number[];

  // Health
  health: HealthStatus;
  HealthIcon: typeof TrendingUp;

  // Streak
  currentStreak: Streak;

  // Stats
  winRate: number;
}

export function useBotStatusState({
  bot,
  yesPrice,
  positions,
}: UseBotStatusStateProps): BotStatusState {
  const [now, setNow] = useState(Date.now());

  // Update timer every second when bot is running
  useEffect(() => {
    if (!bot.enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [bot.enabled]);

  // Strategy info
  const strategyColor = useMemo(() => getStrategyColor(bot.strategy), [bot.strategy]);
  const strategyName = useMemo(() => getStrategyName(bot.strategy), [bot.strategy]);

  // Calculate running time
  const runningTime = bot.enabled && bot.runTime ? now - bot.runTime : 0;

  // Bot positions
  const botPositions = useMemo(
    () => positions.filter((p) => p.botId === bot.id),
    [positions, bot.id]
  );
  // FIX: positionsValue should be amount at risk (dollars bet), NOT stake (shares)
  // amount = dollars invested, stake = shares received (amount/odds)
  const positionsValue = useMemo(
    () => botPositions.reduce((sum, p) => sum + p.amount + (p.fee || 0), 0),
    [botPositions]
  );

  // Unrealized PnL
  const unrealizedPnl = useMemo(
    () =>
      botPositions.reduce((sum, pos) => {
        const currentOdds = pos.outcome === "YES" ? yesPrice : 1 - yesPrice;
        const entryOdds = pos.odds;
        const currentValue = pos.amount * (currentOdds / entryOdds);
        return sum + (currentValue - pos.amount - (pos.fee || 0));
      }, 0),
    [botPositions, yesPrice]
  );

  // Closed positions
  const closedPositions = useMemo(
    () => (bot.portfolio.closedPositions || []) as Position[],
    [bot.portfolio.closedPositions]
  );

  // Equity curve and related calculations
  const {
    recentTrades,
    lastTradePnl,
    initialBalance,
    growthPercent,
    equityCurvePlot,
    balanceGrowth,
  } = useMemo(() => {
    const recentTrades = closedPositions.slice(0, 8).map((p) => p.pnl || 0);
    const lastTrade = closedPositions[0];
    const lastTradePnl = lastTrade?.pnl || 0;
    const totalClosedPnL = closedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);

    // CRITICAL FIX: Use portfolio.initialBalance from backend (source of truth)
    // Fallback to calculation only if initialBalance is not set
    const initialBalance = bot.portfolio.initialBalance ?? bot.portfolio.balance - totalClosedPnL;

    const balanceGrowth = bot.portfolio.balance - initialBalance;
    const growthPercent = initialBalance > 0 ? (balanceGrowth / initialBalance) * 100 : 0;

    // Build equity curve
    const equityCurvePlot = [initialBalance];
    let currentBalance = initialBalance;
    [...closedPositions].reverse().forEach((p) => {
      currentBalance += p.pnl || 0;
      equityCurvePlot.push(currentBalance);
    });
    if (equityCurvePlot.length === 1) {
      equityCurvePlot.push(initialBalance);
    }

    return {
      recentTrades,
      lastTradePnl,
      initialBalance,
      growthPercent,
      equityCurvePlot,
      balanceGrowth,
    };
  }, [closedPositions, bot.portfolio.balance]);

  // Health status
  const health = useMemo((): HealthStatus => {
    if (!bot.enabled)
      return { status: "stopped", color: "#6b7280", icon: XCircle, label: "Stopped" };
    if (bot.stats.trades === 0 && runningTime > 60000)
      return { status: "idle", color: "#f59e0b", icon: AlertCircle, label: "Idle" };
    if (bot.stats.pnl < 0)
      return { status: "losing", color: "#ef4444", icon: TrendingDown, label: "Losing" };
    return { status: "winning", color: "#22c55e", icon: TrendingUp, label: "Winning" };
  }, [bot.enabled, bot.stats.trades, bot.stats.pnl, runningTime]);

  // Current streak
  const currentStreak = useMemo((): Streak => {
    if (closedPositions.length === 0) return { type: "none", count: 0 };
    let streak = 0;
    let streakType: "win" | "loss" = "win";
    for (let i = 0; i < closedPositions.length; i++) {
      const pnl = closedPositions[i].pnl || 0;
      if (i === 0) {
        streakType = pnl > 0 ? "win" : "loss";
        streak = 1;
      } else {
        const currentType = pnl > 0 ? "win" : "loss";
        if (currentType === streakType) {
          streak++;
        } else {
          break;
        }
      }
    }
    return { type: streakType, count: streak };
  }, [closedPositions]);

  // Win rate
  const winRate = bot.stats.trades > 0 ? (bot.stats.wins / bot.stats.trades) * 100 : 0;

  return {
    runningTime,
    strategyColor,
    strategyName,
    botPositions,
    positionsValue,
    unrealizedPnl,
    closedPositions,
    recentTrades,
    lastTradePnl,
    initialBalance,
    balanceGrowth,
    growthPercent,
    equityCurvePlot,
    health,
    HealthIcon: health.icon,
    currentStreak,
    winRate,
  };
}
