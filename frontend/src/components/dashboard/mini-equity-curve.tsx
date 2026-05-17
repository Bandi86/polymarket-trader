"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { useAggregatePortfolio, usePortfolioHistory } from "@/hooks";

interface MiniCurveProps {
  botId?: number;
  compact?: boolean;
}

export function MiniEquityCurve({ botId, compact = false }: MiniCurveProps) {
  const { data: historyData } = usePortfolioHistory();
  const { data: agg } = useAggregatePortfolio();
  const [_hovered, setHovered] = useState(false);

  const initialBalance = agg?.total_initial ?? 100;

  const chartData = useMemo(() => {
    if (!historyData?.history || historyData.history.length === 0) return [];

    // Note: /portfolio/history returns aggregate only (no per-bot breakdown).
    // The botId prop is accepted for API compatibility but filtering is not applied.
    const filtered = historyData.history;

    if (filtered.length === 0) return [];

    // Take last 50 points for mini view
    const recent = filtered.slice(-50);

    let peak = -Infinity;
    return recent.map((h) => {
      if (h.pnl > peak) peak = h.pnl;
      const drawdown = peak > 0 ? ((h.pnl - peak) / peak) * 100 : 0;
      return {
        time: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        pnl: Number(h.pnl.toFixed(2)),
        balance: Number((initialBalance + h.pnl).toFixed(2)),
        drawdown: Number(Math.abs(drawdown).toFixed(1)),
      };
    });
  }, [historyData, initialBalance]);

  if (chartData.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-zinc-900/40 ${compact ? "h-16" : "h-20"}`}
      >
        <span className="text-[10px] text-zinc-600">Nincs adat</span>
      </div>
    );
  }

  const firstPnl = chartData[0]?.pnl ?? 0;
  const lastPnl = chartData[chartData.length - 1]?.pnl ?? 0;
  const isPositive = lastPnl >= 0;
  const color = isPositive ? "#22c55e" : "#ef4444";
  const _colorAlpha = isPositive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)";

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <ResponsiveContainer width="100%" height={48}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${botId ?? "main"}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#grad-${botId ?? "main"})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* PnL badge */}
        <div
          className={`absolute right-1 top-1 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 ${
            isPositive ? "text-green-400" : "text-red-400"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-2.5 w-2.5" />
          ) : (
            <TrendingDown className="h-2.5 w-2.5" />
          )}
          <span className="text-[9px] font-bold font-mono">
            {isPositive ? "+" : ""}
            {lastPnl.toFixed(1)}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-zinc-200">Mini Equity Curve</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">{chartData.length} pont</span>
          <span
            className={`flex items-center gap-1 text-xs font-bold ${
              isPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}
            {lastPnl.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="grad-main" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.5} />
              <stop offset="95%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              fontSize: "11px",
              color: "#e4e4e7",
            }}
            labelStyle={{ color: "#71717a", marginBottom: "2px" }}
            itemStyle={{ color }}
            formatter={(value: unknown) => [`$${Number(value).toFixed(2)}`, "P&L"]}
          />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke={color}
            strokeWidth={2}
            fill="url(#grad-main)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-lg bg-zinc-900/60 px-2 py-1.5">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Start</span>
          <span className="text-xs font-bold font-mono text-zinc-300">${firstPnl.toFixed(2)}</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-zinc-900/60 px-2 py-1.5">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Current</span>
          <span
            className={`text-xs font-bold font-mono ${isPositive ? "text-green-400" : "text-red-400"}`}
          >
            ${lastPnl.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-zinc-900/60 px-2 py-1.5">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Change</span>
          <span
            className={`text-xs font-bold font-mono ${isPositive ? "text-green-400" : "text-red-400"}`}
          >
            {isPositive ? "+" : ""}
            {(lastPnl - firstPnl).toFixed(2)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
