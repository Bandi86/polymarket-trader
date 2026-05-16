"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Clock, Target, X } from "lucide-react";
import { useAppStore } from "@/store";

interface Notification {
  id: number;
  result: {
    endTime: number;
    targetPrice: number;
    finalPrice: number;
    delta: number;
    duration: number;
  };
  timestamp: number;
}

function formatBTC(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return price.toFixed(2);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function MarketTransitionAlert() {
  const marketHistory = useAppStore((s) => s.marketHistory);
  const timeRemaining = useAppStore((s) => s.timeRemaining);
  const currentMarket = useAppStore((s) => s.currentMarket);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prevLengthRef = useRef(marketHistory.length);
  const idCounter = useRef(0);

  useEffect(() => {
    if (marketHistory.length > prevLengthRef.current) {
      const newResult = marketHistory[marketHistory.length - 1];
      idCounter.current += 1;
      const notif: Notification = {
        id: idCounter.current,
        result: newResult,
        timestamp: Date.now(),
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 5));

      const timer = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      }, 8000);

      prevLengthRef.current = marketHistory.length;
      return () => clearTimeout(timer);
    }
    prevLengthRef.current = marketHistory.length;
  }, [marketHistory.length]);

  const dismiss = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const hasActiveMarket = currentMarket !== null && timeRemaining > 0;

  const reversed = [...marketHistory].reverse();

  return (
    <div className="relative rounded-xl border border-white/8 bg-white/[0.03] p-4">
      {/* Current Market Indicator */}
      <div className="mb-4 flex items-center gap-2 border-b border-white/8 pb-3">
        <div
          className={`h-2 w-2 rounded-full ${hasActiveMarket ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`}
        />
        <span className="text-xs font-medium text-zinc-400">
          {hasActiveMarket ? "Market Active" : "No Active Market"}
        </span>
        {hasActiveMarket && (
          <span className="ml-auto text-[10px] font-mono text-zinc-500">
            {formatDuration(timeRemaining)} remaining
          </span>
        )}
      </div>

      {/* Floating Notification Queue */}
      <div className="mb-4 flex flex-col gap-2">
        <AnimatePresence>
          {notifications.map((n) => {
            const { result } = n;
            const isUp = result.finalPrice >= result.targetPrice;
            const absDelta = Math.abs(result.delta);

            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`relative overflow-hidden rounded-lg border p-3 ${
                  isUp
                    ? "border-green-500/30 bg-gradient-to-r from-green-500/10 to-transparent"
                    : "border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent"
                }`}
              >
                <button
                  type="button"
                  onClick={() => dismiss(n.id)}
                  className="absolute right-2 top-2 rounded p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>

                <div className="flex items-center gap-2 mb-2">
                  {isUp ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={`text-xs font-bold ${isUp ? "text-green-400" : "text-red-400"}`}
                  >
                    Market {isUp ? "UP" : "DOWN"}
                  </span>
                  <span className="text-[10px] text-zinc-500">{timeAgo(n.timestamp)}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Target className="h-3 w-3" />
                      Target
                    </span>
                    <p className="font-mono font-semibold text-zinc-200">
                      ${formatBTC(result.targetPrice)}
                    </p>
                  </div>
                  <div>
                    <span className="flex items-center gap-1 text-zinc-500">
                      <TrendingUp className="h-3 w-3" />
                      Final
                    </span>
                    <p className="font-mono font-semibold text-zinc-200">
                      ${formatBTC(result.finalPrice)}
                    </p>
                  </div>
                  <div>
                    <span className="flex items-center gap-1 text-zinc-500">Δ</span>
                    <p
                      className={`font-mono font-bold ${isUp ? "text-green-400" : "text-red-400"}`}
                    >
                      {isUp ? "+" : ""}
                      {formatBTC(absDelta)}
                    </p>
                  </div>
                </div>

                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(result.duration)}
                  </span>
                  <span>
                    {isUp
                      ? `BTC ended above target by $${formatBTC(absDelta)}`
                      : `BTC ended below target by $${formatBTC(absDelta)}`}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Market History Timeline */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-xs font-semibold text-zinc-300">History Timeline</span>
          <span className="text-[10px] text-zinc-500">{reversed.length} results</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {reversed.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-600">
              No completed markets yet
            </div>
          ) : (
            reversed.map((result, i) => {
              const isUp = result.delta >= 0;
              const absDelta = Math.abs(result.delta);

              return (
                <motion.div
                  key={result.endTime}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2"
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${
                      isUp ? "bg-green-500/15" : "bg-red-500/15"
                    }`}
                  >
                    {isUp ? (
                      <TrendingUp className="h-3 w-3 text-green-400" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-400" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 items-center gap-3 text-[11px]">
                    <span className={`font-bold ${isUp ? "text-green-400" : "text-red-400"}`}>
                      {isUp ? "UP" : "DOWN"}
                    </span>
                    <span className="text-zinc-500">
                      ${formatBTC(result.targetPrice)} → ${formatBTC(result.finalPrice)}
                    </span>
                    <span className={`font-mono font-bold ${isUp ? "text-green-400" : "text-red-400"}`}>
                      {isUp ? "+" : ""}
                      {formatBTC(absDelta)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Clock className="h-3 w-3 text-zinc-600" />
                    <span className="text-[10px] font-mono text-zinc-600">
                      {formatDuration(result.duration)}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
