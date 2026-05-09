"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useAggregatePortfolio, usePortfolioHistory } from "@/hooks";

interface DataPoint {
  time: string;
  pnl: number;
}

export function EquityCurve() {
  const { data: historyData, isLoading: isHistoryLoading } = usePortfolioHistory();
  const { data: agg, isLoading: isAggLoading } = useAggregatePortfolio();
  const [timeRange, setTimeRange] = useState<"1H" | "24H" | "7D" | "ALL">("24H");

  // Process the history data from the backend based on timeRange
  const chartData = useMemo(() => {
    if (!historyData?.history || historyData.history.length === 0) return [];
    
    let filteredHistory = historyData.history;
    const now = Date.now();
    
    if (timeRange === "1H") {
      filteredHistory = filteredHistory.filter(h => now - h.timestamp <= 60 * 60 * 1000);
    } else if (timeRange === "24H") {
      filteredHistory = filteredHistory.filter(h => now - h.timestamp <= 24 * 60 * 60 * 1000);
    } else if (timeRange === "7D") {
      filteredHistory = filteredHistory.filter(h => now - h.timestamp <= 7 * 24 * 60 * 60 * 1000);
    }

    // Ensure we always have at least 2 points (like starting at 0 if none exist earlier)
    const points: DataPoint[] = filteredHistory.map(h => ({
      time: timeRange === "1H" || timeRange === "24H" 
        ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(h.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      pnl: Number(h.pnl.toFixed(2))
    }));

    return points;
  }, [historyData, timeRange]);

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isPositive ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
            {isPositive ? <TrendingUp className={`h-5 w-5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} /> : <TrendingDown className="h-5 w-5 text-red-400" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Cumulative P&L</h3>
            <div className={`text-xl font-extrabold font-mono ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
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

      {/* Chart */}
      <div className="h-64 w-full">
        {!hasData ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-zinc-500">
            <Zap className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">Nincs elegendő kereskedési adat</p>
            <p className="text-xs opacity-60">Indíts botokat az eredmények követéséhez</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
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
                tickFormatter={(val) => `$${val}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: isPositive ? '#34d399' : '#f87171', fontWeight: 'bold' }}
                labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
              />
              <Area 
                type="monotone" 
                dataKey="pnl" 
                stroke={isPositive ? "#10b981" : "#ef4444"} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#pnlGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
