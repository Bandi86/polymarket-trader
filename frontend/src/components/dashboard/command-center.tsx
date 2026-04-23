"use client";

import { motion } from "framer-motion";
import { Activity, BarChart3, Target, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { ActivityTabs } from "@/components/dashboard/activity-tabs";
import { ChartPanel } from "@/components/dashboard/chart-panel";
import { CompactDataBar } from "@/components/dashboard/compact-data-bar";
import { MarketHistory } from "@/components/dashboard/market-history";
import { QuickTradePanel } from "@/components/dashboard/quick-trade-panel";
import { useAppStore } from "@/store";

export function CommandCenter() {
  const [chartExpanded, setChartExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-4">
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
