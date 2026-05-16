"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Calendar,
  PlayIcon,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Gauge,
  ArrowDown,
} from "lucide-react";
import { STRATEGY_LABELS } from "@/types";

type StrategyKey = keyof typeof STRATEGY_LABELS;

const METRICS = [
  { label: "Total Trades", icon: Activity, value: "—", color: "text-zinc-500" },
  { label: "Win Rate", icon: TrendingUp, value: "—%", color: "text-zinc-500" },
  { label: "Total PnL", icon: DollarSign, value: "—", color: "text-zinc-500" },
  { label: "Sharpe", icon: Gauge, value: "—", color: "text-zinc-500" },
  { label: "Max Drawdown", icon: ArrowDown, value: "—%", color: "text-zinc-500" },
];

export function BacktestResults() {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyKey>("momentum");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Backtest</h3>
        </div>
        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
          Coming Soon
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            Strategy
          </label>
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value as StrategyKey)}
            className="w-full rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-300 outline-none transition-colors focus:border-indigo-500/40"
          >
            {Object.entries(STRATEGY_LABELS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            Date Range
          </label>
          <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-xs text-zinc-600">
            <Calendar className="h-3 w-3" />
            <span>Select range</span>
          </div>
        </div>

        <button
          disabled
          className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-600 cursor-not-allowed"
        >
          <PlayIcon className="h-3.5 w-3.5" />
          Run Backtest
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-4">
        {METRICS.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="rounded-lg border border-dashed border-white/5 bg-white/[0.01] p-3"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="h-3 w-3 text-zinc-600" />
                <span className="text-[10px] text-zinc-600">{m.label}</span>
              </div>
              <span className={`text-lg font-bold font-mono ${m.color}`}>{m.value}</span>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-dashed border-white/5 bg-white/[0.01] p-6">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <TrendingDown className="h-6 w-6 text-zinc-700" />
          <span className="text-xs text-zinc-600">
            Equity curve and trade distribution chart will appear here
          </span>
          <span className="text-[10px] text-zinc-700">
            Run a backtest to see performance visualizations
          </span>
        </div>
      </div>
    </motion.div>
  );
}
