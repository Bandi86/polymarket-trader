"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Lightbulb,
  MessageSquare,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBots } from "@/hooks";
import { useAppStore } from "@/store";

interface BotThought {
  id: string;
  botId: number;
  botName: string;
  timestamp: number;
  thought: string;
  confidence: number;
  action?: "buy" | "sell" | "hold";
  reason?: string;
  outcome?: "WIN" | "LOSS" | "PENDING";
}

export function BotThoughts() {
  const { data: bots = [] } = useBots();
  const botActivities = useAppStore((s) => s.botActivities);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [collapsed, setCollapsed] = useState(false);

  // Extract thoughts from bot activities
  const thoughts = useMemo(() => {
    const items: BotThought[] = [];
    for (const [botId, activities] of Object.entries(botActivities)) {
      const bid = Number(botId);
      const bot = bots.find((b) => b.id === bid);
      const name = bot?.name ?? `Bot ${bid}`;

      for (const activity of activities) {
        if (activity.type === "trade_decision") {
          const outcome = (activity.data.outcome as string) ?? "";
          const isBuy = outcome.includes("YES");
          const confidence = (activity.data.confidence as number) ?? 0;
          const reason = (activity.data.reason as string) ?? "";

          items.push({
            id: activity.id,
            botId: bid,
            botName: name,
            timestamp: activity.timestamp,
            thought: `Decided to ${isBuy ? "BUY" : "SELL"} with ${(confidence * 100).toFixed(0)}% confidence`,
            confidence,
            action: isBuy ? "buy" : "sell",
            reason: reason || undefined,
          });
        }
      }
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    return items.slice(0, 50);
  }, [botActivities, bots]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [autoScroll]);

  const filtered = thoughts.filter((t) => {
    if (filter === "ALL") return true;
    if (filter === "BUY") return t.action === "buy";
    if (filter === "SELL") return t.action === "sell";
    return true;
  });

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString("hu-HU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const totalThoughts = thoughts.length;
  const buyCount = thoughts.filter((t) => t.action === "buy").length;
  const sellCount = thoughts.filter((t) => t.action === "sell").length;
  const avgConfidence = totalThoughts > 0
    ? thoughts.reduce((sum, t) => sum + t.confidence, 0) / totalThoughts
    : 0;

  if (collapsed) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2 cursor-pointer"
      >
        <Brain className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-semibold text-zinc-200">Bot Thoughts</span>
        <span className="text-[10px] text-zinc-500">({totalThoughts})</span>
        <ChevronRight className="h-3 w-3 text-zinc-500 ml-auto" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-white/8 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-zinc-200">Bot Thoughts</span>
            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold text-violet-400">
              AI
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">{totalThoughts} thoughts</span>
            <button
              onClick={() => setCollapsed(true)}
              className="rounded-md p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center rounded-lg bg-zinc-900/60 px-2 py-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Total</span>
            <span className="text-sm font-bold font-mono text-zinc-200">{totalThoughts}</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-green-500/5 border border-green-500/20 px-2 py-1.5">
            <span className="text-[9px] text-green-400 uppercase tracking-wider">Buy</span>
            <span className="text-sm font-bold font-mono text-green-400">{buyCount}</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-red-500/5 border border-red-500/20 px-2 py-1.5">
            <span className="text-[9px] text-red-400 uppercase tracking-wider">Sell</span>
            <span className="text-sm font-bold font-mono text-red-400">{sellCount}</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-violet-500/5 border border-violet-500/20 px-2 py-1.5">
            <span className="text-[9px] text-violet-400 uppercase tracking-wider">Avg Conf</span>
            <span className="text-sm font-bold font-mono text-violet-400">{(avgConfidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-3 w-3 text-zinc-500" />
          {(["ALL", "BUY", "SELL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase cursor-pointer transition-all ${
                filter === f
                  ? "bg-violet-500/20 border border-violet-500/40 text-violet-300"
                  : "bg-zinc-900/60 border border-white/10 text-zinc-500 hover:text-zinc-400"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Thoughts list */}
      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto space-y-1 px-4 pb-3"
        onMouseEnter={() => setAutoScroll(false)}
        onMouseLeave={() => setAutoScroll(true)}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <MessageSquare className="h-6 w-6 text-zinc-700" />
            <span className="text-sm text-zinc-500">Nincs gondolat</span>
            <span className="text-xs text-zinc-600">A botok gondolatai itt jelennek meg</span>
          </div>
        ) : (
          filtered.map((thought) => (
            <motion.div
              key={thought.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 rounded-lg bg-zinc-900/40 border border-white/5 px-3 py-2 hover:bg-white/[0.02] transition-colors"
            >
              {/* Bot icon */}
              <Bot className="h-3.5 w-3.5 text-zinc-600 shrink-0 mt-0.5" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold text-zinc-300 truncate">{thought.botName}</span>
                  <span className="text-[9px] font-mono text-zinc-600 shrink-0">{formatTime(thought.timestamp)}</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{thought.thought}</p>
                {thought.reason && (
                  <p className="text-[10px] text-zinc-600 mt-1 italic">{thought.reason}</p>
                )}
              </div>

              {/* Confidence badge */}
              <div
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  thought.confidence >= 0.7
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : thought.confidence >= 0.5
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                }`}
              >
                {(thought.confidence * 100).toFixed(0)}%
              </div>

              {/* Action badge */}
              {thought.action && (
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${
                    thought.action === "buy"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {thought.action}
                </span>
              )}
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}