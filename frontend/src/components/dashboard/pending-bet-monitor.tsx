"use client";

import { motion } from "framer-motion";
import { Activity, Clock, DollarSign, Target, TrendingUp, Zap } from "lucide-react";
import { useMemo } from "react";
import { useAppStore } from "@/store";

interface PendingBet {
  botId: number;
  botName: string;
  side: string;
  size: number;
  price: number;
  unrealizedPnl: number;
  timestamp: number;
}

const _EMPTY_ACTIVITIES: never[] = [];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ProgressBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  return (
    <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        initial={{ width: `${pct}%` }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: "linear" }}
        className={`h-full rounded-full transition-colors ${
          pct > 50 ? "bg-emerald-500/60" : pct > 25 ? "bg-amber-500/60" : "bg-red-500/60"
        }`}
      />
    </div>
  );
}

function PnlDisplay({ pnl }: { pnl?: number }) {
  const value = pnl ?? 0;
  const isPositive = value >= 0;
  return (
    <span
      className={`font-mono text-[11px] font-bold ${
        isPositive ? "text-emerald-400" : "text-red-400"
      }`}
    >
      {isPositive ? "+" : ""}${Math.abs(value).toFixed(2)}
    </span>
  );
}

export function PendingBetMonitor() {
  const botActivities = useAppStore((s) => s.botActivities);
  const startPrice = useAppStore((s) => s.startPrice);
  const btcPrice = useAppStore((s) => s.btcPrice);
  const _priceDelta = useAppStore((s) => s.priceDelta);
  const timeRemaining = useAppStore((s) => s.timeRemaining);
  const bots = useAppStore((s) => s.bots);
  const btcDiff = (btcPrice || 0) - (startPrice || 0);

  const pendingBets = useMemo(() => {
    const bets: PendingBet[] = [];
    for (const [botIdStr, activities] of Object.entries(botActivities)) {
      const botId = Number(botIdStr);
      const bot = bots.find((b) => b.id === botId);
      const botName = bot?.name ?? `Bot ${botId}`;
      for (const activity of activities) {
        if (activity.type === "position_update") {
          const side = activity.data.side as string;
          bets.push({
            botId,
            botName,
            side,
            size: (activity.data.size as number) ?? 0,
            price: (activity.data.price as number) ?? 0,
            unrealizedPnl: (activity.data.unrealizedPnl as number) ?? 0,
            timestamp: activity.timestamp,
          });
        }
      }
    }
    bets.sort((a, b) => b.timestamp - a.timestamp);
    return bets;
  }, [botActivities, bots]);

  const count = pendingBets.length;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Active Bets
          </span>
          {count > 0 && (
            <motion.span
              key={count}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
            >
              {count}
            </motion.span>
          )}
        </div>
        {startPrice > 0 && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-zinc-600" />
            <span className="text-[10px] font-mono text-zinc-500">
              Entry: ${startPrice.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto space-y-2">
        {count === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-2 py-8 text-center"
          >
            <div className="relative">
              <Target className="h-8 w-8 text-zinc-700" />
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-indigo-500/10"
              />
            </div>
            <span className="text-sm text-zinc-500">No active bets</span>
            <span className="text-xs text-zinc-600">Waiting for bots to enter positions...</span>
          </motion.div>
        ) : (
          pendingBets.map((bet) => {
            const isYes = bet.side === "YES";
            // Polymarket expected winnings: YES = size * (1/price - 1), NO = size * (price/(1-price))
            const expectedWinnings = isYes
              ? bet.size * (1 / bet.price - 1)
              : bet.size * (bet.price / (1 - bet.price));

            return (
              <motion.div
                key={`${bet.botId}-${bet.timestamp}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                layout
                className="relative rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden hover:bg-white/[0.05] transition-colors"
              >
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            isYes ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        <motion.div
                          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className={`absolute -inset-1 rounded-full ${
                            isYes ? "bg-green-500/30" : "bg-red-500/30"
                          }`}
                        />
                      </div>
                      <span className="text-xs font-medium text-zinc-300">{bet.botName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-indigo-400/60" />
                      <PnlDisplay pnl={bet.unrealizedPnl || expectedWinnings} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isYes
                          ? "bg-green-500/15 text-green-400 border border-green-500/20"
                          : "bg-red-500/15 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {bet.side}
                    </span>
                    {bet.size > 0 && (
                      <span className="text-[10px] font-mono text-zinc-400">
                        ${bet.size.toFixed(2)}
                      </span>
                    )}
                    {bet.price > 0 && (
                      <span className="text-[10px] font-mono text-zinc-600">
                        @ {(bet.price * 100).toFixed(0)}¢
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-600">
                      <TrendingUp
                        className={`h-3 w-3 ${btcDiff >= 0 ? "text-green-400" : "text-red-400"}`}
                      />
                      <span
                        className={`font-mono ${btcDiff >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {btcDiff >= 0 ? "+" : ""}
                        {btcDiff.toFixed(1)}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-zinc-600 shrink-0" />
                    <ProgressBar remaining={timeRemaining} total={300} />
                    <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
