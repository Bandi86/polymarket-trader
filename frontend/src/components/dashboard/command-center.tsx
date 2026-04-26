"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Target,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ActivityTabs } from "@/components/dashboard/activity-tabs";
import { BotSelector } from "@/components/dashboard/bot-selector";
import { ChartPanel } from "@/components/dashboard/chart-panel";
import { CompactDataBar } from "@/components/dashboard/compact-data-bar";
import { MarketHistory } from "@/components/dashboard/market-history";
import { QuickTradePanel } from "@/components/dashboard/quick-trade-panel";
import { useSettings, useUserBalance, useAggregatePortfolio } from "@/hooks";
import { useAppStore } from "@/store";

// Balance & Portfolio Display Component
function BalanceCard() {
  const { userBalance } = useAppStore();
  const { data: balanceData, isLoading } = useUserBalance();

  // Prefer hook data, fallback to store
  const balance = balanceData?.balance ?? userBalance;
  const hasCredentials = balanceData?.has_credentials ?? false;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-sm text-zinc-500">Egyenleg betöltése...</span>
        </div>
      </div>
    );
  }

  if (!hasCredentials || balance === null || balance === undefined) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              USDC Egyenleg
            </span>
            <div className="text-xl font-extrabold font-mono text-emerald-400">
              ${typeof balance === "number" ? balance.toFixed(2) : "0.00"}
            </div>
          </div>
        </div>
        <Link
          href="/settings"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Beállítások →
        </Link>
      </div>
    </div>
  );
}

// Aggregate Portfolio Display - Combined bot trading stats (only shown when bots have trades)
function AggregatePortfolioCard() {
  const { data: agg, isLoading } = useAggregatePortfolio();

  // Hide when loading, no bots, or no trading data yet (avoids confusion with wallet balance)
  if (isLoading || !agg || agg.total_bots === 0 || agg.total_trades === 0) return null;

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 backdrop-blur-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
            <Activity className="h-4 w-4 text-violet-400" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Bot Trading Statisztika
          </span>
        </div>
        <span className="text-[10px] text-zinc-600">
          {agg.running_bots}/{agg.total_bots} fut • {agg.total_trades} trade
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div>
          <span className="text-[10px] text-zinc-500">P&L</span>
          <div className={`text-base font-extrabold font-mono ${
            agg.total_pnl >= 0 ? "text-green-400" : "text-red-400"
          }`}>
            {agg.total_pnl >= 0 ? "+" : ""}${agg.total_pnl.toFixed(2)}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500">Win Rate</span>
          <div className="text-base font-extrabold font-mono text-emerald-400">
            {agg.overall_win_rate.toFixed(1)}%
          </div>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500">ROI</span>
          <div className={`text-base font-extrabold font-mono ${
            agg.overall_roi_percent >= 0 ? "text-green-400" : "text-red-400"
          }`}>
            {agg.overall_roi_percent >= 0 ? "+" : ""}{agg.overall_roi_percent.toFixed(1)}%
          </div>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500">Avg/Trade</span>
          <div className={`text-base font-extrabold font-mono ${
            agg.avg_pnl_per_trade >= 0 ? "text-green-400" : "text-red-400"
          }`}>
            {agg.avg_pnl_per_trade >= 0 ? "+" : ""}${agg.avg_pnl_per_trade.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommandCenter() {
  const [chartExpanded, setChartExpanded] = useState(false);
  const { hasCredentials, userBalance } = useAppStore();
  const { data: settings } = useSettings();

  // Wait for client-side mount to avoid hydration mismatch
  // Server doesn't have access to localStorage, so isConnected may differ
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // Use settings hook data if available, otherwise fallback to store
  const isConnected = isMounted && (hasCredentials || (settings?.has_credentials ?? false));
  const walletAddress = settings?.wallet_address;

  // Hide banner during initial load to prevent flickering between connected/disconnected states
  const bannerHidden = !isMounted;

  return (
    <div className="flex flex-col gap-4">
      {/* Connection Status Banner */}
      {!bannerHidden && !isConnected ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-200">Nincs csatlakoztatva</h3>
              <p className="mt-1 text-sm text-amber-400/80">
                A Polymarket API kulcsok hiányoznak. Add hozzá őket a Beállításokban a trading botok
                használatához.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Beállítások megnyitása</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <span className="text-xs text-amber-400/60">vagy köss azonnali ügyletet lent</span>
              </div>
            </div>
          </div>
        </motion.div>
      ) : bannerHidden ? null : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                <Wallet className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-emerald-200">
                  Polymarket csatlakoztatva
                </h3>
                <p className="mt-0.5 text-sm text-emerald-400/80">
                  {walletAddress && walletAddress !== "***"
                    ? `Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    : "API kulcsok betöltve"}
                  {userBalance !== null && userBalance !== undefined && (
                    <span className="ml-3 font-mono font-semibold text-emerald-300">
                      Egyenleg: {userBalance.toFixed(2)} USDC
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Link
              href="/settings"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Beállítások →
            </Link>
          </div>
        </motion.div>
      )}

      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
        <BalanceCard />
      </motion.div>

      {/* Aggregate Portfolio Card */}
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
        <AggregatePortfolioCard />
      </motion.div>

      {/* TOP: Market Data Bar - Full Width */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <CompactDataBar />
      </motion.div>

      {/* MAIN CONTENT */}
      <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_minmax(420px,1.55fr)_minmax(280px,1fr)]">
        {/* Left: Quick Trade */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
        >
          <QuickTradePanel />
        </motion.div>

        {/* Center: Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="min-w-0"
        >
          <ChartPanel expanded={chartExpanded} onToggle={() => setChartExpanded(!chartExpanded)} />
        </motion.div>

        {/* Right: Activity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <ActivityTabs />
        </motion.div>
      </div>

      {/* BOTTOM: Stats Bar + Market History */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatsBar />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <MarketHistory />
        </motion.div>
      </div>

      {/* BOT PANEL: Single combined selector + fleet */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <BotSelector />
      </motion.div>
    </div>
  );
}

// Stats Bar - Horizontal, Centered Stats
function StatsBar() {
  const { systemStatus, positions, bots } = useAppStore();

  const totalPnl = systemStatus?.total_pnl ?? 0;
  const winRate =
    positions.length > 0
      ? (positions.filter((p) => (p.pnl ?? 0) > 0).length / positions.length) * 100
      : 0;
  const activeBots = bots.filter((b) => b.status === "running").length;
  const totalExposure = positions.reduce((sum, p) => sum + p.stake, 0);
  const livePnl = positions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

  const stats = [
    {
      label: "P&L",
      value: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`,
      color: totalPnl >= 0 ? "text-green-500" : "text-red-500",
      bg: totalPnl >= 0 ? "bg-green-500/15" : "bg-red-500/15",
      border: totalPnl >= 0 ? "border-green-500/30" : "border-red-500/30",
      icon: Trophy,
    },
    {
      label: "Live PnL",
      value: `${livePnl >= 0 ? "+" : ""}${livePnl.toFixed(2)}`,
      color: livePnl >= 0 ? "text-emerald-400" : "text-rose-400",
      bg: livePnl >= 0 ? "bg-emerald-500/15" : "bg-rose-500/15",
      border: livePnl >= 0 ? "border-emerald-500/30" : "border-rose-500/30",
      icon: Activity,
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(0)}%`,
      color: winRate >= 50 ? "text-green-500" : "text-amber-500",
      bg: winRate >= 50 ? "bg-green-500/15" : "bg-amber-500/15",
      border: winRate >= 50 ? "border-green-500/30" : "border-amber-500/30",
      icon: BarChart3,
    },
    {
      label: "Trades",
      value: `${positions.length}`,
      color: "text-violet-400",
      bg: "bg-violet-500/15",
      border: "border-violet-500/30",
      icon: Activity,
    },
    {
      label: "Exposure",
      value: `$${totalExposure.toFixed(0)}`,
      color: totalExposure > 0 ? "text-amber-500" : "text-zinc-500",
      bg: totalExposure > 0 ? "bg-amber-500/15" : "bg-zinc-800/50",
      border: totalExposure > 0 ? "border-amber-500/30" : "border-white/10",
      icon: Target,
    },
    {
      label: "Bots",
      value: `${activeBots}/${bots.length}`,
      color: activeBots > 0 ? "text-green-500" : "text-zinc-500",
      bg: activeBots > 0 ? "bg-green-500/15" : "bg-zinc-800/50",
      border: activeBots > 0 ? "border-green-500/30" : "border-white/10",
      icon: Zap,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl">
      <div className="flex flex-wrap items-stretch justify-center gap-3 px-3 py-3 sm:px-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`flex min-w-[140px] flex-1 items-center gap-3 rounded-xl border px-4 py-2 sm:flex-none ${stat.bg} ${stat.border}`}
          >
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {stat.label}
              </span>
              <span className={`text-lg font-extrabold font-mono ${stat.color}`}>{stat.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
