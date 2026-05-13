"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Clock,
  Coins,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/utils";

interface ActiveMarket {
  condition_id: string;
  question: string;
  description: string | null;
  yes_token_id: string;
  no_token_id: string;
  yes_price: f64;
  no_price: f64;
  start_time: number;
  end_time: number;
  time_remaining: number;
  volume: number;
  liquidity: number;
  asset: string;
  timeframe: string;
  price_to_beat: number | null;
  status: string;
  category: string;
  group: string;
  timeframe_label: string;
}

type f64 = number;

const ASSET_ICONS: Record<string, string> = {
  BTC: "₿",
  ETH: "⟠",
  SOL: "◎",
  XRP: "✕",
};

const ASSET_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#9945ff",
  XRP: "#00aae4",
};

const TIMEFRAMES = [
  { key: "all", label: "Összes" },
  { key: "5", label: "5min" },
  { key: "15", label: "15min" },
  { key: "60", label: "1h" },
  { key: "240", label: "4h" },
  { key: "D", label: "1d" },
];

export default function MarketsPage() {
  const router = useRouter();
  const [markets, setMarkets] = useState<ActiveMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Category tabs
  const [activeAsset, setActiveAsset] = useState<string>("all");
  const [activeTimeframe, setActiveTimeframe] = useState("all");

  const loadMarkets = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      setRefreshing(true);
      try {
        const data = await apiFetch<{
          success: boolean;
          markets: ActiveMarket[];
          count: number;
        }>(`/market/active?timeframe=${activeTimeframe}`);
        if (data.success) {
          setMarkets(data.markets);
        }
      } catch {
        setMarkets([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTimeframe]
  );

  useEffect(() => {
    const hasToken = typeof window !== "undefined" && localStorage.getItem("token");
    if (!hasToken) {
      router.push("/login");
      return;
    }
    loadMarkets();
  }, [loadMarkets, router]);

  const filteredMarkets = useMemo(() => {
    let list = [...markets];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.question.toLowerCase().includes(q) ||
          m.asset.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    if (activeAsset !== "all") {
      list = list.filter((m) => m.group === activeAsset);
    }
    // Sort: by asset group, then by time remaining
    list.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.time_remaining - b.time_remaining;
    });
    return list;
  }, [markets, searchQuery, activeAsset]);

  const groupedMarkets = useMemo(() => {
    const groups: Record<string, ActiveMarket[]> = {};
    for (const m of filteredMarkets) {
      const key = m.group || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return groups;
  }, [filteredMarkets]);

  const handleCreateBot = (market: ActiveMarket) => {
    const params = new URLSearchParams({
      marketId: market.condition_id,
      marketName: market.question.slice(0, 50),
    });
    router.push(`/bots?${params.toString()}`);
  };

  const assetList = useMemo(() => {
    const unique = new Set(markets.map((m) => m.group));
    return ["all", ...Array.from(unique).sort()];
  }, [markets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10">
            <BarChart3 className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Piacok</h1>
            <p className="text-sm text-zinc-500">
              {markets.length} aktív piac &middot; {Object.keys(groupedMarkets).length} kategória
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadMarkets(false)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Frissítés
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4 backdrop-blur-sm space-y-4">
        {/* Asset tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {assetList.map((asset) => (
            <button
              key={asset}
              type="button"
              onClick={() => setActiveAsset(asset)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                activeAsset === asset
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "bg-zinc-800/50 text-zinc-400 border border-white/5 hover:text-zinc-200"
              }`}
            >
              {asset === "all" ? (
                <Coins className="h-3.5 w-3.5" />
              ) : (
                <span style={{ color: ASSET_COLORS[asset] }}>{ASSET_ICONS[asset] || "?"}</span>
              )}
              {asset === "all" ? "Összes" : asset}
              <span className="text-zinc-600 ml-0.5">
                {markets.filter((m) => asset === "all" || m.group === asset).length}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Timeframe + toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Keresés piacok között..."
              className="w-full rounded-lg border border-white/10 bg-zinc-800/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex rounded-lg border border-white/10 bg-zinc-800/30 p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                type="button"
                onClick={() => setActiveTimeframe(tf.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTimeframe === tf.key
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Markets Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-zinc-900/30 py-20">
          <BarChart3 className="h-12 w-12 text-zinc-700 mb-4" />
          <p className="text-lg font-medium text-zinc-400">Nincs elérhető piac</p>
          <p className="text-sm text-zinc-600 mt-1">Próbálj más szűrőt vagy időkeretet</p>
          <button
            type="button"
            onClick={() => loadMarkets()}
            className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/25 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Újrapróbálás
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedMarkets).map(([group, groupMarkets]) => (
            <div key={group}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl" style={{ color: ASSET_COLORS[group] || "#818cf8" }}>
                  {ASSET_ICONS[group] || "?"}
                </span>
                <h2 className="text-lg font-bold text-white">{group}</h2>
                <span className="text-xs text-zinc-600">{groupMarkets.length} piac</span>
                <div className="flex-1 border-t border-white/5" />
              </div>

              <AnimatePresence>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {groupMarkets.map((market, idx) => (
                    <MarketCard
                      key={market.condition_id}
                      market={market}
                      idx={idx}
                      onCreateBot={() => handleCreateBot(market)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MarketCard({
  market,
  idx,
  onCreateBot,
}: {
  market: ActiveMarket;
  idx: number;
  onCreateBot: () => void;
}) {
  const yesPct = (market.yes_price * 100).toFixed(1);
  const noPct = (market.no_price * 100).toFixed(1);
  const timeStr =
    market.time_remaining > 0
      ? `${Math.floor(market.time_remaining / 60)}m ${market.time_remaining % 60}s`
      : "Lejárt";
  const isActive = market.time_remaining > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className="rounded-xl border border-white/5 bg-zinc-900/50 hover:border-white/10 transition-all overflow-hidden group"
    >
      {/* Colored top bar */}
      <div className="h-1" style={{ background: ASSET_COLORS[market.group] || "#818cf8" }} />

      <div className="p-4 space-y-3">
        {/* Header: badge + timeframe */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{
                color: ASSET_COLORS[market.group] || "#818cf8",
                backgroundColor: `${ASSET_COLORS[market.group] || "#818cf8"}15`,
              }}
            >
              {market.group} {market.timeframe_label}
            </span>
            {isActive && (
              <span className="flex items-center gap-1 rounded px-1.5 py-0.5 bg-green-500/10 border border-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] font-bold uppercase text-green-400">Aktív</span>
              </span>
            )}
          </div>
          <span className="text-[11px] text-zinc-600 font-mono">{formatVolume(market.volume)}</span>
        </div>

        {/* Question */}
        <p className="text-sm font-medium text-zinc-200 leading-snug line-clamp-2 min-h-[2.5em]">
          {market.question}
        </p>

        {/* Price odds */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase text-emerald-400">YES</span>
            </div>
            <span className="text-xl font-extrabold font-mono text-emerald-400">{yesPct}¢</span>
          </div>
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <TrendingDown className="h-3 w-3 text-red-400" />
              <span className="text-[10px] font-bold uppercase text-red-400">NO</span>
            </div>
            <span className="text-xl font-extrabold font-mono text-red-400">{noPct}¢</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-[11px] text-zinc-600">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeStr}
            </span>
          </div>
          <button
            type="button"
            onClick={onCreateBot}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-500/20"
          >
            <Zap className="h-3 w-3" />
            Bot
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function formatVolume(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
