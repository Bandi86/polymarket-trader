"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpDown,
  Award,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
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

export function StrategyPanel() {
  const { data: agg, isLoading: aggLoading } = useAggregatePortfolio();
  const { data: bots = [], isLoading: botsLoading } = useBots();
  const [view, setView] = useState<"cards" | "table">("cards");
  const [sortField, setSortField] = useState<SortField>("totalPnl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const best = strategies[0];
  const worst = strategies[strategies.length - 1];
  const totalTrades = strategies.reduce((sum, s) => sum + s.totalTrades, 0);

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

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Summary + View Toggle */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Stratégiák</div>
            <div className="text-lg font-extrabold font-mono text-emerald-400">
              {strategies.length}
            </div>
          </div>
          <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 px-3 py-2">
            <div className="flex items-center gap-1">
              <Award className="h-3 w-3 text-violet-400" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Legjobb</span>
            </div>
            <div className="text-sm font-bold font-mono text-violet-400">{best.name}</div>
          </div>
          {totalTrades > 0 && (
            <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Összes trade</div>
              <div className="text-lg font-extrabold font-mono text-blue-400">{totalTrades}</div>
            </div>
          )}
        </div>

        {/* View toggle tabs */}
        <div className="flex rounded-lg border border-white/10 bg-zinc-800/30 p-1">
          <button
            type="button"
            onClick={() => setView("cards")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              view === "cards"
                ? "bg-indigo-500/20 text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Card View
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              view === "table"
                ? "bg-indigo-500/20 text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Table View
          </button>
        </div>
      </div>

      {/* Cards View */}
      {view === "cards" && (
        <div className="space-y-2">
          {strategies.map((strategy) => {
            const isPositive = strategy.totalPnl >= 0;
            const wr = strategy.totalTrades > 0 ? strategy.winRate : 0;

            return (
              <motion.div
                key={strategy.strategyType}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-3 hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isPositive ? "bg-green-500/15" : "bg-red-500/15"
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-green-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-100">{strategy.name}</div>
                      <div className="text-[10px] text-zinc-500">
                        {strategy.category} · {strategy.botCount} bot
                        {strategy.botCount > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-base font-extrabold font-mono ${
                        isPositive ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {isPositive ? "+" : ""}${strategy.totalPnl.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {strategy.totalTrades} trades · {wr.toFixed(1)}% WR
                    </div>
                  </div>
                </div>

                {/* Win rate bar */}
                {strategy.totalTrades > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 flex h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="bg-green-500/50 transition-all duration-500"
                        style={{ width: `${wr}%` }}
                      />
                      <div
                        className="bg-red-500/30 transition-all duration-500"
                        style={{ width: `${100 - wr}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      ${strategy.avgPnl >= 0 ? "+" : ""}${strategy.avgPnl.toFixed(2)}
                      /trade
                    </span>
                  </div>
                )}

                {strategy.totalTrades === 0 && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600">
                    <AlertTriangle className="h-3 w-3" />
                    Még nem kereskedett
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Footer: best vs worst comparison */}
          {strategies.length >= 2 && (
            <div className="rounded-lg bg-zinc-900/60 border border-white/10 px-3 py-2">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-amber-400" />
                  <span className="text-zinc-500">Best vs Worst:</span>
                  <span className="text-green-400 font-mono">+${best.totalPnl.toFixed(2)}</span>
                  <span className="text-zinc-600">vs</span>
                  <span className="text-red-400 font-mono">
                    {worst.totalPnl >= 0 ? "+" : ""}${worst.totalPnl.toFixed(2)}
                  </span>
                </div>
                <span className="text-zinc-600 font-mono">
                  Spread: ${(best.totalPnl - worst.totalPnl).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] overflow-x-auto">
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
                    <div className="flex items-center gap-1.5 justify-end">
                      <span>{col.label}</span>
                      <ArrowUpDown
                        className={`h-3 w-3 transition-opacity ${
                          sortField === col.field ? "opacity-100 text-indigo-400" : "opacity-30"
                        }`}
                      />
                      {sortField === col.field && (
                        <span className="text-indigo-400 text-[9px] leading-none">
                          {sortDir === "asc" ? "↑" : "↓"}
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

                return (
                  <tr
                    key={s.strategyType}
                    className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors"
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
                    <td className="px-3 py-2.5 font-mono text-green-400 text-right">
                      {s.totalWins}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-red-400 text-right">
                      {s.totalLosses}
                    </td>
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
      )}
    </div>
  );
}
