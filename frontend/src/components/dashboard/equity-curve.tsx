"use client";

import { TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAggregatePortfolio, usePortfolioHistory } from "@/hooks";

interface DataPoint {
  time: string;
  pnl: number;
  drawdown: number;
  balance: number;
}

interface PerfStats {
  totalPnl: number;
  maxDrawdown: number;
  sharpe: number;
  profitFactor: number;
  winRate: number;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload) return null;
  const pnlItem = payload.find((p) => p.dataKey === "pnl");
  const ddItem = payload.find((p) => p.dataKey === "drawdown");
  const balItem = payload.find((p) => p.dataKey === "balance");
  return (
    <div
      style={{
        backgroundColor: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <div style={{ color: "#a1a1aa", marginBottom: "4px" }}>{label}</div>
      {pnlItem && (
        <div style={{ color: pnlItem.color, fontWeight: "bold" }}>
          P&L: ${Number(pnlItem.value).toFixed(2)}
        </div>
      )}
      {balItem && (
        <div style={{ color: balItem.color, fontWeight: "bold" }}>
          Balance: ${Number(balItem.value).toFixed(2)}
        </div>
      )}
      {ddItem && (
        <div style={{ color: ddItem.color, fontWeight: "bold" }}>
          Drawdown: {Number(ddItem.value).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function DDotip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div
      style={{
        backgroundColor: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <div style={{ color: "#a1a1aa", marginBottom: "4px" }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, fontWeight: "bold" }}>
          DD: {Number(entry.value).toFixed(1)}%
        </div>
      ))}
    </div>
  );
}

export function EquityCurve() {
  const { data: historyData, isLoading: isHistoryLoading } = usePortfolioHistory();
  const { data: agg, isLoading: isAggLoading } = useAggregatePortfolio();
  const [timeRange, setTimeRange] = useState<"1H" | "24H" | "7D" | "ALL">("24H");

  const initialBalance = agg?.total_initial ?? 0;

  const chartData = useMemo(() => {
    if (!historyData?.history || historyData.history.length === 0) return [];

    let filteredHistory = historyData.history;
    const now = Date.now();

    if (timeRange === "1H") {
      filteredHistory = filteredHistory.filter((h) => now - h.timestamp <= 60 * 60 * 1000);
    } else if (timeRange === "24H") {
      filteredHistory = filteredHistory.filter((h) => now - h.timestamp <= 24 * 60 * 60 * 1000);
    } else if (timeRange === "7D") {
      filteredHistory = filteredHistory.filter((h) => now - h.timestamp <= 7 * 24 * 60 * 60 * 1000);
    }

    let peak = -Infinity;
    const points: DataPoint[] = filteredHistory.map((h) => {
      if (h.pnl > peak) peak = h.pnl;
      const drawdown = peak > 0 ? ((h.pnl - peak) / peak) * 100 : 0;
      return {
        time:
          timeRange === "1H" || timeRange === "24H"
            ? new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : new Date(h.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }),
        pnl: Number(h.pnl.toFixed(2)),
        drawdown: Number(drawdown.toFixed(2)),
        balance: Number((initialBalance + h.pnl).toFixed(2)),
      };
    });

    return points;
  }, [historyData, timeRange, initialBalance]);

  const perfStats = useMemo(() => {
    const stats: PerfStats = {
      totalPnl: agg?.total_pnl ?? 0,
      maxDrawdown: 0,
      sharpe: 0,
      profitFactor: 0,
      winRate: agg?.overall_win_rate ?? 0,
    };

    if (chartData.length < 2) return stats;

    stats.maxDrawdown = Number(Math.abs(Math.min(...chartData.map((d) => d.drawdown))).toFixed(1));

    const returns: number[] = [];
    for (let i = 1; i < chartData.length; i++) {
      returns.push(chartData[i].pnl - chartData[i - 1].pnl);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    stats.sharpe = stdDev > 0 ? Number((avgReturn / stdDev).toFixed(2)) : 0;

    const grossProfit = returns.filter((r) => r > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(returns.filter((r) => r < 0).reduce((a, b) => a + b, 0));
    stats.profitFactor =
      grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? Infinity : 0;

    return stats;
  }, [chartData, agg]);

  if (isAggLoading || isHistoryLoading) {
    return (
      <div className="h-64 rounded-xl border border-white/8 bg-zinc-950/50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-xs text-zinc-500">Adatok betöltése...</span>
        </div>
      </div>
    );
  }

  const hasData = chartData.length > 0;
  const isPositive = agg ? agg.total_pnl >= 0 : true;

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-xl p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${isPositive ? "bg-emerald-500/15" : "bg-red-500/15"}`}
          >
            {isPositive ? (
              <TrendingUp
                className={`h-5 w-5 ${isPositive ? "text-emerald-400" : "text-red-400"}`}
              />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Cumulative P&L</h3>
            <div
              className={`text-xl font-extrabold font-mono ${isPositive ? "text-emerald-400" : "text-red-400"}`}
            >
              {isPositive ? "+" : ""}${agg?.total_pnl.toFixed(2) ?? "0.00"}
            </div>
          </div>
        </div>

        {/* Time Filters */}
        <div className="flex gap-1 rounded-lg bg-zinc-900/80 p-1 border border-white/5">
          {(["1H", "24H", "7D", "ALL"] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`rounded px-3 py-1 text-xs font-medium transition-all ${
                timeRange === range
                  ? "bg-indigo-500/20 text-indigo-400 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Stats Bar */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          {
            label: "Total PnL",
            value: `${isPositive ? "+" : ""}$${perfStats.totalPnl.toFixed(2)}`,
            color: isPositive ? "text-emerald-400" : "text-red-400",
          },
          {
            label: "Max DD",
            value: `${perfStats.maxDrawdown.toFixed(1)}%`,
            color: "text-red-400",
          },
          {
            label: "Sharpe",
            value: perfStats.sharpe === Infinity ? "∞" : perfStats.sharpe.toFixed(2),
            color:
              perfStats.sharpe >= 1
                ? "text-emerald-400"
                : perfStats.sharpe >= 0
                  ? "text-amber-400"
                  : "text-red-400",
          },
          {
            label: "Profit Factor",
            value: perfStats.profitFactor === Infinity ? "∞" : perfStats.profitFactor.toFixed(2),
            color:
              perfStats.profitFactor >= 1.5
                ? "text-emerald-400"
                : perfStats.profitFactor >= 1
                  ? "text-amber-400"
                  : "text-red-400",
          },
          {
            label: "Win Rate",
            value: `${perfStats.winRate.toFixed(1)}%`,
            color: perfStats.winRate >= 50 ? "text-emerald-400" : "text-red-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-zinc-900/60 border border-white/5 p-2 text-center"
          >
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{stat.label}</div>
            <div className={`text-sm font-bold font-mono ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Equity Curve Chart */}
      <div className="h-48 w-full">
        {!hasData ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-zinc-500">
            <Zap className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">No trading data yet</p>
            <p className="text-xs opacity-60">Start bots to begin tracking results</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isPositive ? "#10b981" : "#ef4444"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isPositive ? "#10b981" : "#ef4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#52525b"
                fontSize={10}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="#52525b"
                fontSize={10}
                tickFormatter={(val) => `$${val}`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#52525b"
                fontSize={10}
                tickFormatter={(val) => `$${val}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="pnl"
                stroke={isPositive ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#pnlGradient)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="balance"
                stroke="#6366f1"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="drawdown"
                stroke="transparent"
                strokeWidth={0}
                dot={false}
                activeDot={false}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Drawdown Chart */}
      <div className="h-20 w-full mt-2">
        {hasData && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#52525b"
                fontSize={10}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#52525b"
                fontSize={10}
                tickFormatter={(val) => `${val}%`}
                axisLine={false}
                tickLine={false}
                domain={["auto", 0]}
              />
              <Tooltip content={<DDotip />} />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#ef4444"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#ddGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
