"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bot,
  Crosshair,
  DollarSign,
  Eye,
  Loader2,
  Play,
  Square,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useBots, usePortfolio, useStartBot, useStopBot } from "@/hooks";
import { apiFetch } from "@/lib/utils";
import { useAppStore } from "@/store";
import type { Bot as BotType, PortfolioResponse } from "@/types";

function BotDetailCard({
  bot,
  portfolio,
  isRunning,
  onStart,
  onStop,
  onDelete,
  isDeleting,
  isMutating,
}: {
  bot: BotType;
  portfolio: PortfolioResponse | undefined;
  isRunning: boolean;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  isMutating: boolean;
}) {
  const isActive = bot.status === "running";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className={`rounded-2xl border backdrop-blur-xl overflow-hidden transition-all duration-500 ${
        isActive
          ? "border-green-500/30 bg-green-500/[0.04] shadow-[0_0_60px_rgba(34,197,94,0.08)]"
          : "border-white/8 bg-white/3"
      }`}
    >
      {/* Active banner */}
      {isActive && (
        <div className="relative overflow-hidden bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent px-4 py-2">
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              animate={{ x: ["0%", "100%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute h-full w-1/3 bg-gradient-to-r from-transparent via-green-400/10 to-transparent"
            />
          </div>
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40" />
              <div className="relative h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
              Trading Active
            </span>
            <span className="text-[10px] text-zinc-500 ml-auto">
              {bot.trading_mode === "live" ? "Live Mode" : "Paper Mode"}
            </span>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Header: Bot name, strategy, actions */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                isRunning
                  ? "bg-green-500/15 border-green-500/30"
                  : bot.status === "error"
                    ? "bg-red-500/15 border-red-500/30"
                    : "bg-zinc-500/10 border-white/10"
              }`}
            >
              {isRunning ? (
                <Loader2 className="h-6 w-6 text-green-400 animate-spin" />
              ) : (
                <Bot className="h-6 w-6 text-zinc-400" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-zinc-100 text-base">{bot.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/15 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {bot.strategy_type}
                </span>
                {bot.use_kelly && (
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Kelly
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1">
            {isRunning ? (
              <button
                type="button"
                onClick={() => onStop(bot.id)}
                disabled={isMutating}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                title="Stop Bot"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStart(bot.id)}
                disabled={isMutating}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer"
                title="Start Bot"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(bot.id)}
              disabled={isDeleting}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-red-400 transition-colors cursor-pointer"
              title="Delete Bot"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Trading config row */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
           <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1">
             <DollarSign className="h-3 w-3 text-zinc-400" />
             <span className="text-xs text-zinc-400">Bet:</span>
             <span className="text-xs font-mono font-bold text-zinc-200">
               ${bot.bet_size.toFixed(2)}
             </span>
           </div>
          {bot.use_kelly && (
            <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1">
              <Zap className="h-3 w-3 text-amber-400" />
              <span className="text-xs text-zinc-400">Kelly:</span>
              <span className="text-xs font-mono font-bold text-zinc-200">
                {(bot.kelly_fraction * 100).toFixed(0)}%
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1">
            <Target className="h-3 w-3 text-red-400" />
            <span className="text-xs text-zinc-400">SL:</span>
            <span className="text-xs font-mono font-bold text-zinc-200">
              {(bot.stop_loss * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1">
            <TrendingUp className="h-3 w-3 text-green-400" />
            <span className="text-xs text-zinc-400">TP:</span>
            <span className="text-xs font-mono font-bold text-zinc-200">
              {(bot.take_profit * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Stats grid from portfolio */}
        {portfolio && (
          <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/5 pt-4">
            <div className="rounded-xl bg-green-500/5 border border-green-500/10 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3 w-3 text-green-400" />
                <span className="text-[10px] uppercase text-zinc-500 font-semibold">Balance</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-green-400">
                ${portfolio.balance.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/10 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3 w-3 text-indigo-400" />
                <span className="text-[10px] uppercase text-zinc-500 font-semibold">PnL</span>
              </div>
              <div
                className={`text-lg font-extrabold font-mono ${
                  portfolio.total_pnl >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {portfolio.total_pnl >= 0 ? "+" : ""}${portfolio.total_pnl.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl bg-violet-500/5 border border-violet-500/10 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Crosshair className="h-3 w-3 text-violet-400" />
                <span className="text-[10px] uppercase text-zinc-500 font-semibold">Win Rate</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-violet-400">
                {portfolio.win_rate.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] uppercase text-zinc-500 font-semibold">Trades</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-blue-400">
                {portfolio.total_trades}
              </div>
              <div className="flex gap-1 mt-0.5">
                <span className="text-[9px] text-green-400">{portfolio.winning_trades}W</span>
                <span className="text-[9px] text-red-400">{portfolio.losing_trades}L</span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!portfolio && (
          <div className="mt-4 rounded-xl bg-white/3 border border-white/5 px-4 py-3 text-center">
            <span className="text-xs text-zinc-500">Még nincsenek trading adatok</span>
          </div>
        )}

        {/* Bottom info */}
        {portfolio && (
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3 text-zinc-500" />
                <span className="text-[10px] text-zinc-500">ROI:</span>
                <span
                  className={`text-[10px] font-mono font-bold ${
                    portfolio.roi_percent >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {portfolio.roi_percent >= 0 ? "+" : ""}
                  {portfolio.roi_percent.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-zinc-500" />
                <span className="text-[10px] text-zinc-500">DD:</span>
                <span className="text-[10px] font-mono font-bold text-red-400">
                  {portfolio.drawdown_percent.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="text-[10px] text-zinc-500">
              Avg: <span className="font-mono text-zinc-400">${portfolio.avg_pnl_per_trade.toFixed(2)}</span>/trade
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Wrapper component to call usePortfolio hook per bot (avoids hooks-in-loop violation)
function BotCardWithPortfolio({
  bot,
  isRunning,
  onStart,
  onStop,
  onDelete,
  isDeleting,
  isMutating,
}: {
  bot: BotType;
  isRunning: boolean;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  isMutating: boolean;
}) {
  const { data: portfolio } = usePortfolio(bot.id);
  return (
    <BotDetailCard
      bot={bot}
      portfolio={portfolio}
      isRunning={isRunning}
      onStart={onStart}
      onStop={onStop}
      onDelete={onDelete}
      isDeleting={isDeleting}
      isMutating={isMutating}
    />
  );
}

export function BotFleetPanel() {
  const { bots, selectedBotIds } = useAppStore();
  const startBotMutation = useStartBot();
  const stopBotMutation = useStopBot();
  const { refetch } = useBots();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Show selected bots, or if none selected, show all running bots
  const displayBots = selectedBotIds.length > 0
    ? bots.filter((b) => selectedBotIds.includes(b.id))
    : bots.filter((b) => b.status === "running");

  const isMutating = startBotMutation.isPending || stopBotMutation.isPending;

  const startBot = (id: number) => {
    startBotMutation.mutate(id, {
      onSuccess: () => toast.success("Bot elindítva"),
      onError: (err) => toast.error(err.message || "Hiba a bot indításakor"),
    });
  };

  const stopBot = (id: number) => {
    stopBotMutation.mutate(id, {
      onSuccess: () => toast.success("Bot leállítva"),
      onError: (err) => toast.error(err.message || "Hiba a bot leállításakor"),
    });
  };

  const deleteBot = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(`/bots/${id}`, { method: "DELETE" });
      toast.success("Bot törölve!");
      refetch();
    } catch (_err) {
      toast.error("Hiba a bot törlésekor");
    } finally {
      setDeletingId(null);
    }
  };

  if (displayBots.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-10 flex flex-col items-center justify-center text-center"
      >
        <div className="h-16 w-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
          <Bot className="h-8 w-8 text-violet-400" />
        </div>
        <h3 className="text-lg font-bold text-zinc-200">Nincs aktív bot</h3>
        <p className="text-sm text-zinc-500 mt-1.5 max-w-sm">
          Válassz ki 1-2 botot a fenti Bot Selectorból, vagy indíts el egyet a /bots oldalon.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Active count */}
      {displayBots.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-semibold text-green-400">
            {displayBots.length} bot active
          </span>
        </div>
      )}

      <AnimatePresence>
        {displayBots.map((bot) => (
          <BotCardWithPortfolio
            key={bot.id}
            bot={bot}
            isRunning={bot.status === "running"}
            onStart={startBot}
            onStop={stopBot}
            onDelete={deleteBot}
            isDeleting={deletingId === bot.id}
            isMutating={isMutating}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
