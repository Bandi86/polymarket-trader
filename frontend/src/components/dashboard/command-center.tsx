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
import { useState } from "react";
import { ActivityTabs } from "@/components/dashboard/activity-tabs";
import { ChartPanel } from "@/components/dashboard/chart-panel";
import { CompactDataBar } from "@/components/dashboard/compact-data-bar";
import { MarketHistory } from "@/components/dashboard/market-history";
import { QuickTradePanel } from "@/components/dashboard/quick-trade-panel";
import { useSettings } from "@/hooks";
import { useAppStore } from "@/store";

export function CommandCenter() {
  const [chartExpanded, setChartExpanded] = useState(false);
  const { hasCredentials, userBalance } = useAppStore();
  const { data: settings } = useSettings();

  // Use settings hook data if available, otherwise fallback to store
  const isConnected = hasCredentials || (settings?.has_credentials ?? false);
  const walletAddress = settings?.wallet_address;

  return (
    <div className="flex flex-col gap-4">
      {/* Connection Status Banner */}
      {!isConnected ? (
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
      ) : (
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
