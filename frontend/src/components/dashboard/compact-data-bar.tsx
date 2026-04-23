"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bitcoin,
  ChevronDown,
  Clock,
  Loader2,
  Play,
  Square,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useStartBot, useStopBot } from "@/hooks";
import { useAppStore } from "@/store";

function formatBTCPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return price.toFixed(2);
}

function formatPriceDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}`;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K`;
  return `$${volume.toFixed(0)}`;
}

export function CompactDataBar() {
  const { btcPrice, startPrice, priceDelta, yesPrice, timeRemaining, volume, marketQuestion, bots, selectedBotId, setSelectedBot } = useAppStore();
  const [botDropdownOpen, setBotDropdownOpen] = useState(false);
  const startBot = useStartBot();
  const stopBot = useStopBot();

  const selectedBot = bots.find((b) => b.id === selectedBotId);
  const isBotRunning = selectedBot?.status === "running";

  const handleToggleBot = () => {
    if (!selectedBotId) return;
    if (isBotRunning) {
      stopBot.mutate(selectedBotId);
    } else {
      startBot.mutate(selectedBotId);
    }
  };

  const marketPrediction = yesPrice > 0.5 ? "EXCEED" : "STAY BELOW";
  const confidence = Math.abs(yesPrice - 0.5) * 100;
  const isUp = priceDelta >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl"
    >
      {/* Status Banner - Full Width, Color-coded */}
      <div
        className={`mx-4 mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300
        ${
          isUp && btcPrice > 0
            ? "bg-green-500/20 border border-green-500/40 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
            : btcPrice > 0
              ? "bg-red-500/20 border border-red-500/40 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
              : "bg-zinc-800/50 border border-white/10 text-zinc-400"
        }`}
      >
        {isUp && btcPrice > 0 ? (
          <TrendingUp className="h-5 w-5" />
        ) : btcPrice > 0 ? (
          <TrendingDown className="h-5 w-5" />
        ) : (
          <Clock className="h-5 w-5" />
        )}
        <span>
          {isUp && btcPrice > 0
            ? "ABOVE TARGET"
            : btcPrice > 0
              ? "BELOW TARGET"
              : "WAITING FOR DATA"}
        </span>
        {isUp && btcPrice > 0 && priceDelta !== 0 && (
          <span className="text-xs font-mono text-green-500/80">
            +{formatPriceDelta(priceDelta)}
          </span>
        )}
        {!isUp && btcPrice > 0 && priceDelta !== 0 && (
          <span className="text-xs font-mono text-red-500/80">
            {formatPriceDelta(priceDelta)}
          </span>
        )}
      </div>

      {/* Market Question */}
      {marketQuestion && (
        <div className="px-4 pt-2 pb-1 text-center">
          <span className="text-xs font-medium text-zinc-400">{marketQuestion}</span>
        </div>
      )}

      {/* Bot Running Indicator */}
      {isBotRunning && (
        <div className="mx-4 mb-1 flex items-center justify-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-green-500" />
          <span className="text-xs font-semibold text-green-400">
            Bot Running
          </span>
          <span className="text-[10px] text-zinc-500">
            • {selectedBot?.strategy}
          </span>
          <span className="text-[10px] text-zinc-600">
            • Analyzing market
          </span>
        </div>
      )}

      {/* Centered Horizontal Layout */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-3 xl:flex-nowrap xl:gap-6 xl:px-6">
        {/* Timer - Left */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border
            ${
              timeRemaining < 60
                ? "bg-red-500/15 border-red-500/30"
                : timeRemaining < 180
                  ? "bg-amber-500/15 border-amber-500/30"
                  : "bg-green-500/15 border-green-500/30"
            }`}
          >
            <Clock
              className={`h-4 w-4
              ${
                timeRemaining < 60
                  ? "text-red-500"
                  : timeRemaining < 180
                    ? "text-amber-500"
                    : "text-green-500"
              }`}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Ends In
            </span>
            <span className="text-lg font-extrabold font-mono text-zinc-100">
              {timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : "--:--"}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden h-10 w-px bg-white/10 xl:block" />

        {/* Target - Center Left */}
        <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <Target className="h-3 w-3 text-indigo-400" />
            <span className="text-[10px] font-semibold uppercase text-indigo-400">TARGET</span>
          </div>
          <span className="text-base font-extrabold font-mono text-indigo-400">
            ${startPrice > 0 ? formatBTCPrice(startPrice) : "---"}
          </span>
        </div>

        {/* Delta Arrow */}
        <div
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5
          ${isUp ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}
        >
          {priceDelta !== 0 && (
            <motion.div
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              {isUp ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              )}
            </motion.div>
          )}
          <span
            className={`text-xs font-bold font-mono ${isUp ? "text-green-500" : "text-red-500"}`}
          >
            {priceDelta !== 0 ? formatPriceDelta(priceDelta) : "---"}
          </span>
        </div>

        {/* Current BTC Price - Color based on position vs target */}
        <div
          className={`rounded-xl border-2 px-3 py-1.5 transition-all duration-300
          ${isUp && btcPrice > 0
            ? "bg-green-500/15 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
            : btcPrice > 0
              ? "bg-red-500/15 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
              : "bg-orange-500/10 border-orange-500/20"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Bitcoin className={`h-3 w-3 ${isUp && btcPrice > 0 ? "text-green-400" : btcPrice > 0 ? "text-red-400" : "text-orange-400"}`} />
            <span className={`text-[10px] font-semibold uppercase ${isUp && btcPrice > 0 ? "text-green-400" : btcPrice > 0 ? "text-red-400" : "text-orange-400"}`}>
              CURRENT
            </span>
          </div>
          <span className={`text-base font-extrabold font-mono ${isUp && btcPrice > 0 ? "text-green-500" : btcPrice > 0 ? "text-red-500" : "text-orange-400"}`}>
            ${btcPrice > 0 ? formatBTCPrice(btcPrice) : "---"}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden h-10 w-px bg-white/10 xl:block" />

        {/* Volume */}
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] font-semibold uppercase text-emerald-400">VOLUME</span>
          </div>
          <span className="text-base font-extrabold font-mono text-emerald-400">
            {volume > 0 ? formatVolume(volume) : "---"}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden h-10 w-px bg-white/10 xl:block" />

        {/* Market Prediction - Right */}
        <div
          className={`rounded-xl px-3 py-1.5
          ${
            marketPrediction === "EXCEED"
              ? "bg-green-500/10 border border-green-500/20"
              : "bg-red-500/10 border border-red-500/20"
          }`}
        >
          <span className="text-[10px] uppercase text-zinc-500">Market Predicts</span>
          <div
            className={`text-sm font-bold ${marketPrediction === "EXCEED" ? "text-green-500" : "text-red-500"}`}
          >
            {marketPrediction === "EXCEED" ? "BTC WILL EXCEED" : "BTC WILL STAY BELOW"}
          </div>
          <span className="text-[10px] text-zinc-500">{confidence.toFixed(1)}% confidence</span>
        </div>

        {/* Divider */}
        <div className="hidden h-10 w-px bg-white/10 xl:block" />

        {/* Bot Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setBotDropdownOpen(!botDropdownOpen)}
            className="flex items-center gap-2 rounded-xl bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 hover:bg-violet-500/15 transition-colors cursor-pointer"
          >
            <div
              className={`h-2.5 w-2.5 rounded-full ${selectedBot?.status === "running" ? "bg-green-500 animate-pulse" : selectedBot?.status === "error" ? "bg-red-500" : "bg-zinc-500"}`}
            />
            <span className="text-xs font-semibold text-violet-400 max-w-20 truncate">
              {selectedBot?.name ?? "No Bot"}
            </span>
            <ChevronDown
              className={`h-3 w-3 text-violet-400 transition-transform ${botDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Bot Dropdown */}
          <AnimatePresence>
            {botDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-xl overflow-hidden"
              >
                {bots.length === 0 ? (
                  <div className="p-4">
                    <div className="text-center text-xs text-zinc-500 mb-3">
                      No bots configured
                    </div>
                    <a
                      href="/bots"
                      className="flex items-center justify-center gap-2 rounded-lg bg-violet-500/15 text-violet-400 px-3 py-2 text-xs font-semibold hover:bg-violet-500/25 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      Create Your First Bot
                    </a>
                  </div>
                ) : (
                  <>
                    {bots.map((bot) => (
                      <button
                        key={bot.id}
                        type="button"
                        onClick={() => {
                          setSelectedBot(bot.id);
                          setBotDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors cursor-pointer
                        ${bot.id === selectedBotId ? "bg-violet-500/10" : ""}`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${bot.status === "running" ? "bg-green-500 animate-pulse" : bot.status === "error" ? "bg-red-500" : "bg-zinc-500"}`}
                        />
                        <div className="flex flex-1 flex-col min-w-0">
                          <span className="truncate text-xs font-semibold text-zinc-100">
                            {bot.name}
                          </span>
                          <span className="text-[10px] text-zinc-500">{bot.strategy}</span>
                        </div>
                        <span
                          className={`text-[10px] font-medium ${bot.status === "running" ? "text-green-500" : bot.status === "error" ? "text-red-500" : "text-zinc-500"}`}
                        >
                          {bot.status}
                        </span>
                      </button>
                    ))}
                    {selectedBot && (
                      <div className="border-t border-white/10 p-2">
                        <button
                          type="button"
                          onClick={handleToggleBot}
                          disabled={startBot.isPending || stopBot.isPending}
                          className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer
                            ${
                              isBotRunning
                                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                                : "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                            }`}
                        >
                          {isBotRunning ? (
                            <>
                              <Square className="h-3 w-3" />
                              Stop Bot
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3" />
                              Start Bot
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
