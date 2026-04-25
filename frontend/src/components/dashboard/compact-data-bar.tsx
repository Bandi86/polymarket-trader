"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Bitcoin,
  Clock,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useUserBalance } from "@/hooks";
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
  const {
    btcPrice,
    startPrice,
    priceDelta,
    yesPrice,
    timeRemaining,
    volume,
    marketQuestion,
  } = useAppStore();
  const { data: userBalance } = useUserBalance();

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
          <span className="text-xs font-mono text-red-500/80">{formatPriceDelta(priceDelta)}</span>
        )}
      </div>

      {/* Market Question */}
      {marketQuestion && (
        <div className="px-4 pt-2 pb-1 text-center">
          <span className="text-xs font-medium text-zinc-400">{marketQuestion}</span>
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
            <motion.div animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15 }}>
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
          ${
            isUp && btcPrice > 0
              ? "bg-green-500/15 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
              : btcPrice > 0
                ? "bg-red-500/15 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                : "bg-orange-500/10 border-orange-500/20"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Bitcoin
              className={`h-3 w-3 ${isUp && btcPrice > 0 ? "text-green-400" : btcPrice > 0 ? "text-red-400" : "text-orange-400"}`}
            />
            <span
              className={`text-[10px] font-semibold uppercase ${isUp && btcPrice > 0 ? "text-green-400" : btcPrice > 0 ? "text-red-400" : "text-orange-400"}`}
            >
              CURRENT
            </span>
          </div>
          <span
            className={`text-base font-extrabold font-mono ${isUp && btcPrice > 0 ? "text-green-500" : btcPrice > 0 ? "text-red-500" : "text-orange-400"}`}
          >
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

        {/* Balance / Portfolio */}
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3 w-3 text-blue-400" />
            <span className="text-[10px] font-semibold uppercase text-blue-400">BALANCE</span>
          </div>
          <span className="text-base font-extrabold font-mono text-blue-400">
            {userBalance?.has_credentials
              ? `$${userBalance.balance.toFixed(2)}`
              : "---"}
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
      </div>
    </motion.div>
  );
}
