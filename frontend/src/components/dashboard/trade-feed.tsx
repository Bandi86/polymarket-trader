"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Filter,
  Flame,
  Pause,
  Play,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBots } from "@/hooks";
import { useNotificationStore } from "@/lib/notifications";
import { useAppStore } from "@/store";

interface TradeEntry {
  id: string;
  botId: number;
  botName: string;
  timestamp: number;
  side: "UP" | "DOWN" | "YES" | "NO";
  outcome: string;
  size: number;
  confidence: number;
  price?: number;
  won?: boolean;
  pnl?: number;
  market?: string;
  reason?: string;
  entryType: "decision" | "order" | "position" | "result";
  tradingMode: "paper" | "live";
}

export function TradeFeed() {
  const { data: bots = [] } = useBots();
  const botActivities = useAppStore((s) => s.botActivities);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "UP" | "DOWN" | "WIN" | "LOSS">("ALL");

  // Derive trades directly from botActivities — no useEffect needed, prevents infinite loop
  const sseTrades = useMemo(() => {
    const trades: TradeEntry[] = [];
    for (const [botId, activities] of Object.entries(botActivities)) {
      const bid = Number(botId);
      const bot = bots.find((b) => b.id === bid);
      const name = bot?.name ?? `Bot ${bid}`;
      const tradingMode = (bot?.trading_mode as "paper" | "live") ?? "paper";
      for (const activity of activities) {
        if (activity.type === "trade_decision") {
          const rawOutcome = (activity.data.outcome as string) ?? "";
          const side = rawOutcome.includes("YES") ? "UP" : "DOWN";
          trades.push({
            id: activity.id,
            botId: bid,
            botName: name,
            timestamp: activity.timestamp,
            side,
            outcome: rawOutcome,
            size: (activity.data.betSize as number) ?? 0,
            confidence: (activity.data.confidence as number) ?? 0,
            reason: activity.data.reason as string,
            entryType: "decision",
            tradingMode,
          });
        }
        if (activity.type === "trade_result") {
          trades.push({
            id: activity.id,
            botId: bid,
            botName: name,
            timestamp: activity.timestamp,
            side: "UP",
            outcome: (activity.data.won as boolean) ? "WIN" : "LOSS",
            size: 0,
            confidence: 0,
            won: activity.data.won as boolean,
            pnl: activity.data.pnl as number,
            entryType: "result",
            tradingMode,
          });
        }
        if (activity.type === "order_executed") {
          trades.push({
            id: activity.id,
            botId: bid,
            botName: name,
            timestamp: activity.timestamp,
            side: "UP",
            outcome: "FILLED",
            size: 0,
            confidence: 0,
            entryType: "order",
            tradingMode,
          });
        }
        if (activity.type === "position_update") {
          const side = (activity.data.side as string) === "YES" ? "UP" : "DOWN";
          trades.push({
            id: activity.id,
            botId: bid,
            botName: name,
            timestamp: activity.timestamp,
            side,
            outcome: side === "UP" ? "YES" : "NO",
            size: (activity.data.size as number) ?? 0,
            confidence: 0,
            price: activity.data.price as number,
            pnl: activity.data.unrealizedPnl as number,
            entryType: "position",
            tradingMode,
          });
        }
      }
    }

    trades.sort((a, b) => b.timestamp - a.timestamp);
    return trades.slice(0, 100);
  }, [botActivities, bots]);

  // Streak state — derived from notification store
  const getBotStreak = useNotificationStore((s) => s.getBotStreak);
  const streaksByBot = useMemo(() => {
    const map = new Map<string, { consecutive: number; wins: number; losses: number }>();
    for (const trade of sseTrades) {
      if (!map.has(trade.botName)) {
        map.set(
          trade.botName,
          getBotStreak(trade.botName) ?? { consecutive: 0, wins: 0, losses: 0 }
        );
      }
    }
    return map;
  }, [sseTrades, getBotStreak]);

  // Auto-scroll to top (newest first)
  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [autoScroll, paused]);

  const filtered = sseTrades.filter((t) => {
    if (filter === "ALL") return true;
    if (filter === "UP") return t.side === "UP" || t.outcome === "YES";
    if (filter === "DOWN") return t.side === "DOWN" || t.outcome === "NO";
    if (filter === "WIN")
      return t.won === true || (t.entryType === "position" && (t.pnl ?? 0) >= 0);
    if (filter === "LOSS")
      return t.won === false || (t.entryType === "position" && (t.pnl ?? 0) < 0);
    return true;
  });

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString("hu-HU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  // Summary stats
  const totalWins = sseTrades.filter((t) => t.won === true).length;
  const totalLosses = sseTrades.filter((t) => t.won === false).length;
  const _totalPnL = sseTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winRate =
    sseTrades.filter((t) => t.won !== undefined).length > 0
      ? (totalWins / sseTrades.filter((t) => t.won !== undefined).length) * 100
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden"
    >
      {/* Enhanced Header */}
      <div className="flex flex-col gap-2 border-b border-white/8 px-4 pt-3 pb-2">
        {/* Row 1: Title + Live indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-zinc-200">Trade Feed</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Live/Paused badge */}
            <div className="flex items-center gap-1.5">
              <motion.span
                animate={paused ? {} : { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
                transition={paused ? {} : { duration: 1.5, repeat: Infinity }}
                className={`w-2 h-2 rounded-full ${paused ? "bg-amber-500" : "bg-emerald-400"}`}
              />
              <span
                className={`text-[10px] font-bold uppercase ${paused ? "text-amber-500" : "text-emerald-400"}`}
              >
                {paused ? "Paused" : "Live"}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Stats bar */}
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center rounded-lg bg-zinc-900/60 px-2 py-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Trades</span>
            <span className="text-sm font-bold font-mono text-zinc-200">{sseTrades.length}</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-green-500/5 border border-green-500/20 px-2 py-1.5">
            <span className="text-[9px] text-green-400 uppercase tracking-wider">Wins</span>
            <span className="text-sm font-bold font-mono text-green-400">{totalWins}</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-red-500/5 border border-red-500/20 px-2 py-1.5">
            <span className="text-[9px] text-red-400 uppercase tracking-wider">Losses</span>
            <span className="text-sm font-bold font-mono text-red-400">{totalLosses}</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-violet-500/5 border border-violet-500/20 px-2 py-1.5">
            <span className="text-[9px] text-violet-400 uppercase tracking-wider">Win Rate</span>
            <span className="text-sm font-bold font-mono text-violet-400">
              {winRate.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Row 3: Filter + Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-zinc-500" />
            {(["ALL", "UP", "DOWN", "WIN", "LOSS"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase cursor-pointer transition-all ${
                  filter === f
                    ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-300"
                    : "bg-zinc-900/60 border border-white/10 text-zinc-500 hover:text-zinc-400 hover:border-white/20"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-600">{filtered.length} entries</span>
            <button
              type="button"
              onClick={() => {
                setPaused(!paused);
                if (!paused) setAutoScroll(false);
                else setAutoScroll(true);
              }}
              className="rounded-md p-1.5 cursor-pointer bg-zinc-900/60 border border-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
              title={paused ? "Resume" : "Pause"}
            >
              {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoScroll(true);
                setPaused(false);
              }}
              className={`rounded-md p-1.5 cursor-pointer border transition-colors ${
                autoScroll
                  ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400"
                  : "bg-zinc-900/60 border-white/10 text-zinc-500 hover:text-zinc-300"
              }`}
              title="Auto-scroll"
            >
              <TrendingUp className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Trade feed */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="max-h-80 overflow-y-auto space-y-1 px-4 pb-3"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          if (!autoScroll) setPaused(false);
        }}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Clock className="h-6 w-6 text-zinc-700" />
            <span className="text-sm text-zinc-500">Még nincsenek tradék</span>
            <span className="text-xs text-zinc-600">
              Indíts el egy botot a trade feed megtekintéséhez
            </span>
          </div>
        ) : (
          filtered.map((trade) => {
            const isWin = trade.won === true;
            const isLoss = trade.won === false;
            const isUp = trade.side === "UP" || trade.outcome === "YES";
            const isOrder = trade.entryType === "order";
            const isPosition = trade.entryType === "position";

            return (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs border-l-2 transition-colors hover:bg-white/[0.03] ${
                  trade.tradingMode === "paper"
                    ? isWin
                      ? "border-l-green-500 border-y border-r border-y-green-500/20 border-r-green-500/20 bg-green-500/5"
                      : isLoss
                        ? "border-l-green-500 border-y border-r border-y-red-500/20 border-r-red-500/20 bg-red-500/5"
                        : "border-l-indigo-500 border-y border-r border-y-white/5 border-r-white/5 bg-white/[0.02]"
                    : isWin
                      ? "border-l-red-500 border-y border-r border-y-green-500/20 border-r-green-500/20 bg-green-500/5"
                      : isLoss
                        ? "border-l-red-500 border-y border-r border-y-red-500/20 border-r-red-500/20 bg-red-500/5"
                        : "border-l-amber-500 border-y border-r border-y-white/5 border-r-white/5 bg-white/[0.02]"
                }`}
              >
                {/* Mode badge */}
                <span
                  className={`text-[8px] font-bold uppercase shrink-0 px-1 rounded ${
                    trade.tradingMode === "paper"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {trade.tradingMode === "paper" ? "DEMO" : "LIVE"}
                </span>
                {/* Time */}
                <span className="text-[10px] font-mono text-zinc-600 shrink-0 w-16">
                  {formatTime(trade.timestamp)}
                </span>

                {/* Bot name + streak */}
                <span
                  className="flex items-center gap-1 shrink-0 w-20 truncate"
                  title={trade.botName}
                >
                  <span className="truncate">{trade.botName}</span>
                  {(() => {
                    const streak = streaksByBot.get(trade.botName);
                    return streak && streak.consecutive >= 2 ? (
                      <Flame
                        className={`h-3 w-3 shrink-0 ${streak.wins > 0 ? "text-orange-400" : "text-blue-400"}`}
                      />
                    ) : null;
                  })()}
                </span>

                {/* Type badge */}
                {isPosition && (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-400/60 bg-indigo-500/10 rounded px-1.5 shrink-0">
                    POS
                  </span>
                )}

                {/* Direction */}
                <div className="flex items-center gap-1 shrink-0">
                  {isUp || isPosition ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span
                    className={`font-bold text-[10px] ${isUp || isPosition ? "text-green-400" : "text-red-400"}`}
                  >
                    {trade.outcome}
                  </span>
                </div>

                {/* Size */}
                {trade.size > 0 && (
                  <span className="font-mono text-zinc-400 shrink-0">${trade.size.toFixed(2)}</span>
                )}

                {/* Price for position updates */}
                {isPosition && trade.price && (
                  <span className="font-mono text-zinc-600 shrink-0">
                    @{(trade.price * 100).toFixed(0)}¢
                  </span>
                )}

                {/* Confidence */}
                {trade.confidence > 0 && (
                  <span className="text-zinc-600 shrink-0">
                    {(trade.confidence * 100).toFixed(0)}%
                  </span>
                )}

                {/* Result / Position PnL / Order status */}
                {isWin || isLoss ? (
                  <span
                    className={`font-bold font-mono ml-auto ${
                      isWin ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {isWin ? "+" : ""}${trade.pnl?.toFixed(2) ?? "0.00"}
                  </span>
                ) : isPosition && trade.pnl != null ? (
                  <span
                    className={`font-bold font-mono ml-auto ${
                      trade.pnl >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                  </span>
                ) : isOrder ? (
                  <span className="text-zinc-600 ml-auto">filled</span>
                ) : null}
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
