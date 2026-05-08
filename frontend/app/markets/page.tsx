"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock,
  DollarSign,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/glass-card";
import { apiFetch } from "@/lib/utils";
import { useAppStore } from "@/store";
import type { Market } from "@/types";

export default function MarketsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAppStore();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOutcome, setFilterOutcome] = useState<"all" | "YES" | "NO">("all");

  const loadMarkets = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setRefreshing(true);
    try {
      const data = await apiFetch<Market[]>("/markets", { method: "GET" });
      setMarkets(data);
    } catch {
      setMarkets([
        {
          id: "btc-up-5m",
          question: "Will BTC go UP in the next 5 minutes?",
          outcomes: ["YES", "NO"],
          outcome_prices: [0.52, 0.48],
          volume: 125000,
          active: true,
          expires_at: Date.now() + 300000,
        },
        {
          id: "btc-down-5m",
          question: "Will BTC go DOWN in the next 5 minutes?",
          outcomes: ["YES", "NO"],
          outcome_prices: [0.48, 0.52],
          volume: 98000,
          active: true,
          expires_at: Date.now() + 300000,
        },
        {
          id: "btc-up-1h",
          question: "Will BTC be above $80,000 in 1 hour?",
          outcomes: ["YES", "NO"],
          outcome_prices: [0.65, 0.35],
          volume: 250000,
          active: true,
          expires_at: Date.now() + 3600000,
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const hasToken = typeof window !== "undefined" && localStorage.getItem("token");
    if (!isAuthenticated && !hasToken) {
      router.push("/login");
      return;
    }
    void loadMarkets();
  }, [isAuthenticated, loadMarkets, router]);

  const filteredMarkets = markets.filter((market) => {
    if (searchQuery && !market.question.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume}`;
  };

  const formatTimeRemaining = (expiresAt?: number) => {
    if (!expiresAt) return "---";
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return "Lejárt";
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const handleLaunchBot = (market: Market) => {
    toast.success(`${market.question.slice(0, 40)}... piachoz bot létrehozása`);
    router.push("/bots");
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow effects */}
      <div
        className="ambient-glow ambient-glow-primary absolute"
        style={{ width: 600, height: 600, top: "10%", left: "20%" }}
      />
      <div
        className="ambient-glow ambient-glow-blue absolute"
        style={{ width: 400, height: 400, bottom: "20%", right: "10%" }}
      />

      <div className="max-w-5xl mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
              <BarChart3 className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Piacok</h1>
              <p className="text-xs text-zinc-500">Elérhető prediction markets</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadMarkets(false)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Frissítés
          </button>
        </div>

        {/* Search and filter */}
        <GlassCard className="p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-800/60 py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500/40"
                placeholder="Keresés a piacok között..."
              />
            </div>
            <div className="flex gap-1.5">
              {(["all", "YES", "NO"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setFilterOutcome(filter)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    filterOutcome === filter
                      ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-300"
                      : "border border-white/10 bg-zinc-800/60 text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  {filter === "all" ? "Összes" : filter}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Markets */}
        {loading ? (
          <GlassCard className="p-12 text-center">
            <Activity className="h-8 w-8 text-zinc-600 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-zinc-500">Piacok betöltése...</p>
          </GlassCard>
        ) : filteredMarkets.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-zinc-400 mb-2">Nincs elérhető piac</h3>
            <p className="text-sm text-zinc-600 mb-4">Jelenleg nincs aktív prediction market</p>
            <button
              type="button"
              onClick={() => void loadMarkets()}
              className="mx-auto flex items-center gap-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/25 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Újrapróbálás
            </button>
          </GlassCard>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMarkets.map((market, idx) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <GlassCard hover className="p-4 cursor-pointer group" animate>
                    {/* Market question */}
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-zinc-100 leading-snug mb-2">
                        {market.question}
                      </h3>
                      {market.active && (
                        <div className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 bg-green-500/10 border border-green-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">
                            Aktív
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Outcomes */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[10px] font-bold uppercase text-emerald-400">
                            YES
                          </span>
                        </div>
                        <span className="text-xl font-extrabold font-mono text-emerald-400">
                          {(market.outcome_prices[0] * 100).toFixed(0)}¢
                        </span>
                      </div>
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                          <span className="text-[10px] font-bold uppercase text-red-400">NO</span>
                        </div>
                        <span className="text-xl font-extrabold font-mono text-red-400">
                          {(market.outcome_prices[1] * 100).toFixed(0)}¢
                        </span>
                      </div>
                    </div>

                    {/* Stats + CTA */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatVolume(market.volume)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeRemaining(market.expires_at)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLaunchBot(market)}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-3 py-1.5 text-xs font-semibold text-indigo-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-500/25"
                      >
                        Bot indítása
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
