"use client";

import { motion } from "framer-motion";
import { ArrowUpDown, BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useAggregatePortfolio, useBots } from "@/hooks";
import { STRATEGY_LABELS } from "@/types";

interface StrategyRow {
  strategyType: string;
  name: string;
  category: string;
  botCount: number;
  totalTrades: number;
  totalPnl: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  avgPnl: number;
  roi: number;
}

type SortField = keyof Pick<
  StrategyRow,
  | "name"
  | "category"
  | "botCount"
  | "totalPnl"
  | "totalTrades"
  | "totalWins"
  | "totalLosses"
  | "winRate"
  | "avgPnl"
  | "roi"
>;

const _SORT_LABELS: Record<SortField, string> = {
  name: "Strategy",
  category: "Category",
  botCount: "Bots",
  totalPnl: "Total PnL",
  totalTrades: "Trades",
  totalWins: "Wins",
  totalLosses: "Losses",
  winRate: "Win Rate",
  avgPnl: "Avg/Trade",
  roi: "ROI%",
};

export function StrategyComparisonTable() {
  const { data: agg, isLoading: aggLoading } = useAggregatePortfolio();
  const { data: bots = [], isLoading: botsLoading } = useBots();

  const [sortField, setSortField] = useState<SortField>("totalPnl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string | null>(null);

  const strategies = useMemo(() => {
    const map = new Map<string, StrategyRow>();

    if (agg?.bots) {
      for (const bp of agg.bots) {
        const bot = bots.find((b) => b.id === bp.bot_id);
        if (!bot) continue;

        const key = bot.strategy_type;
        const config = STRATEGY_LABELS[key as keyof typeof STRATEGY_LABELS];
        const existing = map.get(key);

        if (existing) {
          existing.botCount++;
          existing.totalTrades += bp.total_trades;
          existing.totalPnl += bp.total_pnl;
          existing.totalWins += bp.winning_trades ?? 0;
          existing.totalLosses += bp.losing_trades ?? 0;
        } else {
          map.set(key, {
            strategyType: key,
            name: config?.name ?? key,
            category: config?.category ?? "Other",
            botCount: 1,
            totalTrades: bp.total_trades,
            totalPnl: bp.total_pnl,
            totalWins: bp.winning_trades ?? 0,
            totalLosses: bp.losing_trades ?? 0,
            winRate: 0,
            avgPnl: 0,
            roi: bp.roi_percent ?? 0,
          });
        }
      }
    }

    for (const bot of bots) {
      const key = bot.strategy_type;
      if (!map.has(key)) {
        const config = STRATEGY_LABELS[key as keyof typeof STRATEGY_LABELS];
        map.set(key, {
          strategyType: key,
          name: config?.name ?? key,
          category: config?.category ?? "Other",
          botCount: 1,
          totalTrades: 0,
          totalPnl: 0,
          totalWins: 0,
          totalLosses: 0,
          winRate: 0,
          avgPnl: 0,
          roi: 0,
        });
      } else {
        map.get(key)!.botCount++;
      }
    }

    for (const s of map.values()) {
      s.winRate = s.totalTrades > 0 ? (s.totalWins / s.totalTrades) * 100 : 0;
      s.totalLosses = s.totalTrades - s.totalWins;
      s.avgPnl = s.totalTrades > 0 ? s.totalPnl / s.totalTrades : 0;
    }

    return Array.from(map.values()).sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      const cmp =
        typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [agg, bots, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const columns: { field: SortField; label: string; align: "left" | "right" }[] = [
    { field: "name", label: "Strategy", align: "left" },
    { field: "category", label: "Category", align: "left" },
    { field: "botCount", label: "Bots", align: "right" },
    { field: "totalPnl", label: "Total PnL", align: "right" },
    { field: "totalTrades", label: "Trades", align: "right" },
    { field: "totalWins", label: "Wins", align: "right" },
    { field: "totalLosses", label: "Losses", align: "right" },
    { field: "winRate", label: "Win Rate", align: "right" },
    { field: "avgPnl", label: "Avg/Trade", align: "right" },
    { field: "roi", label: "ROI%", align: "right" },
  ];

  if (aggLoading || botsLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <div className="h-5 w-44 rounded bg-zinc-800 animate-pulse" />
        <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <BarChart3 className="h-8 w-8 text-zinc-700" />
        <span className="text-sm text-zinc-500">No strategies yet</span>
        <span className="text-xs text-zinc-600">
          Create at least one bot to see strategy comparison
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/8 bg-white/[0.03]"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/8">
              {columns.map((col) => (
                <th
                  key={col.field}
                  onClick={() => toggleSort(col.field)}
                  className={`cursor-pointer select-none px-3 py-3 font-semibold text-zinc-400 hover:text-zinc-200 transition-colors ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.label}</span>
                    <ArrowUpDown
                      className={`h-3 w-3 transition-opacity ${
                        sortField === col.field ? "opacity-100 text-indigo-400" : "opacity-30"
                      }`}
                    />
                    {sortField === col.field && (
                      <span className="text-indigo-400 text-[9px] leading-none">
                        {sortDir === "asc" ? "\u2191" : "\u2193"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strategies.map((s) => {
              const isPos = s.totalPnl >= 0;
              const isSelected = selected === s.strategyType;

              return (
                <tr
                  key={s.strategyType}
                  onClick={() => setSelected(isSelected ? null : s.strategyType)}
                  className={`border-b border-white/[0.04] transition-colors cursor-pointer ${
                    isSelected ? "bg-indigo-500/[0.06]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-md ${
                          isPos ? "bg-green-500/15" : "bg-red-500/15"
                        }`}
                      >
                        {isPos ? (
                          <TrendingUp className="h-3 w-3 text-green-400" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-400" />
                        )}
                      </div>
                      <span className="font-semibold text-zinc-100">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500">{s.category}</td>
                  <td className="px-3 py-2.5 font-mono text-zinc-300 text-right">{s.botCount}</td>
                  <td
                    className={`px-3 py-2.5 font-mono font-semibold text-right ${
                      isPos ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {isPos ? "+" : ""}${s.totalPnl.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-zinc-300 text-right">
                    {s.totalTrades}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-green-400 text-right">{s.totalWins}</td>
                  <td className="px-3 py-2.5 font-mono text-red-400 text-right">{s.totalLosses}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {s.totalTrades > 0 ? (
                        <>
                          <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${s.winRate}%`,
                                background:
                                  s.winRate >= 50
                                    ? "linear-gradient(90deg, #22c55e, #16a34a)"
                                    : "linear-gradient(90deg, #ef4444, #dc2626)",
                              }}
                            />
                          </div>
                          <span className="font-mono text-xs text-zinc-400 w-10 text-right">
                            {s.winRate.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right">
                    <span className={s.avgPnl >= 0 ? "text-green-400/80" : "text-red-400/80"}>
                      {s.avgPnl >= 0 ? "+" : ""}${s.avgPnl.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right">
                    <span className={s.roi >= 0 ? "text-green-400" : "text-red-400"}>
                      {s.roi >= 0 ? "+" : ""}
                      {s.roi.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
