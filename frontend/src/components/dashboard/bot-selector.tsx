"use client";

import { motion } from "framer-motion";
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
import { useBots, usePortfolio, useStartBot, useStopBot } from "@/hooks";
import { apiFetch } from "@/lib/utils";
import { useAppStore } from "@/store";
import type { Bot as BotType, PortfolioResponse } from "@/types";
import { toast } from "sonner";

const STRATEGY_COLORS: Record<string, string> = {
  momentum: "#8b5cf6",
  mean_reversion: "#06b6d4",
  last_seconds_scalp: "#f59e0b",
  binance_signal: "#22c55e",
  contrarian: "#ec4899",
  smart_trend: "#3b82f6",
  default: "#71717a",
};

function getStrategyColor(strategy: string): string {
  return STRATEGY_COLORS[strategy] || STRATEGY_COLORS.default;
}

function SquareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1" y="1" width="10" height="10" rx="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2.5 6l2.5 2.5 4.5-5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}

// ── Bot Grid Pill (compact card in the always-visible grid) ──

function BotPill({
  bot,
  isSelected,
  onToggle,
  onStart,
  onStop,
  isMutating,
}: {
  bot: BotType;
  isSelected: boolean;
  onToggle: () => void;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  isMutating: boolean;
}) {
  const isRunning = bot.status === "running";
  const color = getStrategyColor(bot.strategy_type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all cursor-pointer ${
        isSelected
          ? "border-indigo-500/40 bg-indigo-500/10"
          : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15"
      }`}
      onClick={!isRunning ? onToggle : undefined}
    >
      {/* Status icon */}
      <div
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}15` }}
      >
        {isRunning ? (
          <Activity className="h-4 w-4" style={{ color }} />
        ) : (
          <Activity className="h-4 w-4 text-zinc-500" />
        )}
        {isRunning && (
          <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 animate-ping opacity-40" />
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-semibold text-zinc-200">{bot.name}</span>
        <span
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ background: `${color}20`, color }}
        >
          {bot.strategy_type}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {isRunning ? (
          <button
            type="button"
            onClick={() => onStop(bot.id)}
            disabled={isMutating}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            title="Stop"
          >
            <SquareIcon />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStart(bot.id)}
            disabled={isMutating}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer"
            title="Start"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}
        {!isRunning && (
          <button
            type="button"
            onClick={onToggle}
            disabled={isMutating}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
              isSelected
                ? "bg-indigo-500/20 text-indigo-400"
                : "bg-white/5 text-zinc-500 hover:bg-white/10"
            }`}
            title={isSelected ? "Deselect" : "Select"}
          >
            {isSelected ? <CheckIcon /> : <PlusIcon />}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Detailed Bot Card (from fleet panel) ──

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
            <span className="text-xs font-mono font-bold text-zinc-200">${bot.bet_size.toFixed(2)}</span>
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

        {portfolio && portfolio.balance != null && (
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
              <div className="text-lg font-extrabold font-mono text-blue-400">{portfolio.total_trades}</div>
              <div className="flex gap-1 mt-0.5">
                <span className="text-[9px] text-green-400">{portfolio.winning_trades}W</span>
                <span className="text-[9px] text-red-400">{portfolio.losing_trades}L</span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {(!portfolio || portfolio.balance == null) && (
          <div className="mt-4 rounded-xl bg-white/3 border border-white/5 px-4 py-3 text-center">
            <span className="text-xs text-zinc-500">Még nincsenek trading adatok</span>
          </div>
        )}

        {/* Bottom info */}
        {portfolio && portfolio.balance != null && (
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
                  {portfolio.roi_percent >= 0 ? "+" : ""}{portfolio.roi_percent.toFixed(1)}%
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

// ── Main Component ──

export function BotSelector() {
  const { data: botsFromApi, isLoading, isFetching, refetch } = useBots();
  const { selectedBotIds, setSelectedBotIds } = useAppStore();
  const startBotMutation = useStartBot();
  const stopBotMutation = useStopBot();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const botList = botsFromApi ?? [];
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

  const handleToggle = (id: number) => {
    if (selectedBotIds.includes(id)) {
      setSelectedBotIds(selectedBotIds.filter((bid) => bid !== id));
    } else if (selectedBotIds.length < 2) {
      setSelectedBotIds([...selectedBotIds, id]);
    } else {
      toast.error("Maximum 2 bot választható ki egyszerre");
    }
  };

  const deleteBot = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(`/bots/${id}`, { method: "DELETE" });
      toast.success("Bot törölve!");
      if (selectedBotIds.includes(id)) {
        setSelectedBotIds(selectedBotIds.filter((bid) => bid !== id));
      }
      refetch();
    } catch (_err) {
      toast.error("Hiba a bot törlésekor");
    } finally {
      setDeletingId(null);
    }
  };

   const selectedBots = botList.filter((b: BotType) => selectedBotIds.includes(b.id));

   // Only show loading spinner on the VERY FIRST load (keepPreviousData ensures refetches don't trigger this)
  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-xl p-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm text-zinc-500">Botok betöltése...</span>
        </div>
      </div>
    );
  }

  if (botList.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-xl p-6 text-center">
        <Crosshair className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-sm font-medium text-zinc-400">Nincsenek botok</p>
        <p className="text-xs text-zinc-600 mt-1">
          Hozz létre egy botot a{" "}
          <a href="/bots" className="text-indigo-400 hover:underline">Botok</a> oldalon
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-xl overflow-hidden">
      {/* Header - always visible, shows refetch indicator */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15">
            <Crosshair className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-200">Botok</span>
            <span className="text-xs text-zinc-500">
              {botList.length} db • {selectedBotIds.length}/2 kiválasztva
            </span>
          </div>
        </div>
        {isFetching && !isLoading && (
          <Loader2 className="h-3.5 w-3.5 text-zinc-600 animate-spin" />
        )}
      </div>

      <div className="border-t border-white/5 px-4 py-3">
        {/* ── Bot Grid: All bots always visible ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {botList.map((bot) => (
            <BotPill
              key={bot.id}
              bot={bot}
              isSelected={selectedBotIds.includes(bot.id)}
              onToggle={() => handleToggle(bot.id)}
              onStart={startBot}
              onStop={stopBot}
              isMutating={isMutating}
            />
          ))}
        </div>

        {/* ── Detailed Fleet Cards for selected bots ── */}
        {selectedBots.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              Bot Részletek
            </span>
            {selectedBots.map((bot) => (
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
          </div>
        )}
      </div>
    </div>
  );
}
