"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Bot as BotIcon,
  ChevronDown,
  Filter,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Shield,
  Square,
  Trash2,
  TrendingUp,
  Trophy,
  Wallet,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CreateBotModal } from "@/components/bot-creation-modal";
import { MiniEquityCurve } from "@/components/dashboard";
import { apiFetch } from "@/lib/utils";

// ---- Típusok ----
type BotStatus = "running" | "paused" | "error" | "stopped";
type SortKey = "pnl" | "winRate" | "trades" | "balance" | "name" | "roi";

interface TradeResult {
  id: string;
  win: boolean;
  amount: number;
  time: string;
}

interface Bot {
  id: string;
  name: string;
  strategy_type: string;
  status: BotStatus;
  trading_mode: "paper" | "live";
  bet_size: number;
  stop_loss: number;
  take_profit: number;
  market_id: string;
  interval?: number;
  history?: TradeResult[];
  portfolio?: {
    balance: number;
    total_pnl: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    initial_balance?: number;
    roi_percent?: number;
    drawdown_percent?: number;
    avg_pnl_per_trade?: number;
    open_positions?: number;
  };
}

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type: "info" | "success" | "warn" | "error";
}

const STRATEGY_COLORS: Record<string, string> = {
  momentum: "#818cf8",
  mean_reversion: "#34d399",
  last_seconds_scalp: "#f472b6",
  binance_signal: "#38bdf8",
  scalping: "#fb923c",
  edge_hunter: "#a78bfa",
  strict_momentum: "#60a5fa",
  patient_waiter: "#fbbf24",
  signal_momentum_v2: "#f87171",
  extreme_edge: "#4ade80",
  sniper_arb: "#22c55e",
  volatility_filtered: "#8b5cf6",
  high_conviction_momentum: "#f59e0b",
  window_delta: "#06b6d4",
  fair_value: "#ec4899",
  sniper: "#84cc16",
  trend: "#a855f7",
  volatility: "#ef4444",
  contrarian: "#14b8a6",
  oracle_lag: "#0ea5e9",
  bayesian_ev: "#d946ef",
};

const STATUS_COLORS = {
  running: "bg-green-500",
  paused: "bg-amber-500",
  error: "bg-red-500",
  stopped: "bg-zinc-500",
};

export default function BotsPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<
    | {
        marketId?: string;
        marketName?: string;
      }
    | undefined
  >();
  const [sessionTimer, setSessionTimer] = useState<{
    id: number;
    duration_secs: number;
    started_at: string;
    ends_at: string;
    status: string;
    remaining_secs: number;
  } | null>(null);
  const [timerLoading, setTimerLoading] = useState(false);

  // Read URL params for market selection (from Markets page)
  const searchParams = useSearchParams();
  useEffect(() => {
    const marketId = searchParams.get("marketId");
    const marketName = searchParams.get("marketName");
    if (marketId || marketName) {
      setCreatePrefill({ marketId: marketId ?? undefined, marketName: marketName ?? undefined });
      setShowCreateModal(true);
    }
  }, [searchParams]);

  // UI State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BotStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [quickFilter, setQuickFilter] = useState<"none" | "best3" | "worst3">("none");
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sessionBalance, setSessionBalance] = useState("100");

  const prevBotsRef = useRef<Bot[]>([]);

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    const newEntry = {
      id: Math.random().toString(),
      time: new Date().toLocaleTimeString(),
      msg,
      type,
    };
    setLogs((prev) => [newEntry, ...prev].slice(0, 50));
  }, []);

  const loadBots = useCallback(async () => {
    setIsSyncing(true);
    try {
      setAuthRequired(false);
      // Use the backend's aggregate endpoint which fetches bots + portfolios in 2 queries (not N+1)
      const data = await apiFetch<{
        bots: Bot[];
        total_bots: number;
        running_bots: number;
        total_balance: number;
        total_pnl: number;
        overall_win_rate: number;
      }>("/bots");
      const bots = data.bots || data;

      const withPortfolio = bots.map((bot: Bot) => {
        return {
          ...bot,
          portfolio: bot.portfolio
            ? {
                balance: bot.portfolio.balance,
                total_pnl: bot.portfolio.total_pnl,
                total_trades: bot.portfolio.total_trades ?? 0,
                winning_trades: bot.portfolio.winning_trades ?? 0,
                losing_trades: bot.portfolio.losing_trades ?? 0,
                win_rate: bot.portfolio.win_rate ?? 0,
                initial_balance: bot.portfolio.initial_balance,
                roi_percent: bot.portfolio.roi_percent,
                drawdown_percent: bot.portfolio.drawdown_percent,
                open_positions: bot.portfolio.open_positions ?? 0,
              }
            : undefined,
        };
      });

      if (prevBotsRef.current.length > 0) {
        withPortfolio.forEach((newBot) => {
          const oldBot = prevBotsRef.current.find((b) => b.id === newBot.id);
          if (oldBot?.portfolio && newBot.portfolio) {
            if (newBot.portfolio.total_trades > oldBot.portfolio.total_trades) {
              const pnlDiff = newBot.portfolio.total_pnl - oldBot.portfolio.total_pnl;
              const isWin = pnlDiff >= 0;
              const newTrade: TradeResult = {
                id: Math.random().toString(),
                win: isWin,
                amount: Math.abs(pnlDiff),
                time: new Date().toLocaleTimeString(),
              };
              newBot.history = [newTrade, ...(oldBot.history || [])].slice(0, 100);
              addLog(
                `${newBot.name}: ${isWin ? "NYERTES" : "VESZTES"} trade ($${newTrade.amount.toFixed(2)})`,
                isWin ? "success" : "warn"
              );
            } else {
              newBot.history = oldBot.history;
            }
          }
        });
      }

      prevBotsRef.current = withPortfolio;
      setBots(withPortfolio);
      setLastSync(new Date());
      setServerOnline(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Nincs jogosultsága") || msg.includes("401")) {
        setAuthRequired(true);
        setServerOnline(true);
        localStorage.removeItem("token");
        clearInterval(loadBotsIntervalRef.current);
        router.push("/login");
        return;
      }
      setServerOnline(false);
    } finally {
      setIsSyncing(false);
      setInitialLoadComplete(true);
    }
  }, [addLog, router]);

  const loadBotsIntervalRef = useRef<ReturnType<typeof setInterval>>(
    0 as unknown as ReturnType<typeof setInterval>
  );

  const parsedSessionBalance = useMemo(() => {
    const value = Number(sessionBalance);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [sessionBalance]);

  useEffect(() => {
    setMounted(true);
    loadBots();
    loadBotsIntervalRef.current = setInterval(loadBots, 15000);
    return () => clearInterval(loadBotsIntervalRef.current);
  }, [loadBots]);

  // Load session timer status
  const loadSessionTimer = useCallback(async () => {
    try {
      const data = await apiFetch<{
        id: number;
        duration_secs: number;
        started_at: string;
        ends_at: string;
        status: string;
        remaining_secs: number;
      }>("/session/timer");
      setSessionTimer(data);
    } catch {
      setSessionTimer(null);
    }
  }, []);

  // Timer countdown ticker (pure client-side, no server fetch)
  useEffect(() => {
    if (!sessionTimer) return;
    const interval = setInterval(() => {
      setSessionTimer((prev) =>
        prev ? { ...prev, remaining_secs: Math.max(0, prev.remaining_secs - 1) } : null
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionTimer]);

  // Sync with server every 15 seconds to get accurate remaining time
  useEffect(() => {
    if (!sessionTimer) return;
    const interval = setInterval(loadSessionTimer, 15000);
    return () => clearInterval(interval);
  }, [sessionTimer, loadSessionTimer]);

  // 5-minute warning toast
  useEffect(() => {
    if (sessionTimer && sessionTimer.remaining_secs === 300) {
      toast.warning("5 perc maradt a session-ből!");
    }
  }, [sessionTimer]);

  // Detect expired timer from server sync and show summary
  useEffect(() => {
    if (sessionTimer?.status === "expired") {
      // Backend has marked timer as expired, session summary will show via the modal
    }
  }, [sessionTimer?.status]);

  // Stop timer locally when it hits 0 (backup if backend hasn't expired it yet)
  useEffect(() => {
    if (sessionTimer && sessionTimer.remaining_secs === 0 && sessionTimer.status === "active") {
      toast.info("Session lejárt! Botok leállítva.");
      loadSessionTimer(); // Re-sync with server
    }
  }, [sessionTimer, loadSessionTimer]);

  // Start a timed session
  const handleStartTimedSession = async (durationMins: number) => {
    setTimerLoading(true);
    try {
      const res = await apiFetch<{
        id: number;
        duration_secs: number;
        started_at: string;
        ends_at: string;
        status: string;
        remaining_secs: number;
      }>("/session/start", {
        method: "POST",
        body: JSON.stringify({ duration_mins: durationMins }),
      });
      setSessionTimer(res);
      toast.success(`${durationMins} perces session elindítva!`);
      addLog(`Időzített session indítva: ${durationMins} perc`, "success");
      await loadBots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a session indításakor");
    } finally {
      setTimerLoading(false);
    }
  };

  // Cancel session timer
  const handleCancelTimer = async () => {
    if (!confirm("Biztosan törlöd az időzített session-t? A botok tovább fognak futni.")) return;
    setTimerLoading(true);
    try {
      await apiFetch("/session/cancel", { method: "POST" });
      setSessionTimer(null);
      toast.success("Session timer törölve");
      addLog("Session timer törölve", "info");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba");
    } finally {
      setTimerLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleStart = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch<{ success: boolean; status: string }>(`/bots/${id}/start`, {
        method: "POST",
        body: JSON.stringify(
          parsedSessionBalance !== undefined ? { initial_balance: parsedSessionBalance } : {}
        ),
      });
      if (res.success) {
        toast.success(`${name} elindult`);
        addLog(`${name}: Elindítva.`, "success");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hiba történt";
      toast.error(msg);
      addLog(`${name}: Indítási hiba: ${msg}`, "error");
    } finally {
      setActionLoading(null);
      await loadBots();
    }
  };

  const handleStop = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch<{ success: boolean; status: string }>(`/bots/${id}/stop`, {
        method: "POST",
      });
      if (res.success) {
        toast.success(`${name} leállítva`);
        addLog(`${name}: Leállítva.`, "warn");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hiba történt";
      toast.error(msg);
    } finally {
      setActionLoading(null);
      await loadBots();
    }
  };

  const handleReset = async (id: string, name: string) => {
    if (!confirm(`Biztosan nullázod a(z) "${name}" bot statisztikáit?`)) return;
    setActionLoading(id);
    try {
      await apiFetch(`/bots/${id}/reset`, { method: "POST" });
      toast.success(`${name} nullázva`);
      addLog(`${name}: Statisztikák nullázva.`, "info");
      setBots((prev) => prev.map((b) => (b.id === id ? { ...b, history: [] } : b)));
      await loadBots();
    } catch {
      toast.error("Backend hiba");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetAll = async () => {
    if (!confirm("BIZTOSAN nullázni akarod az ÖSSZES bot statisztikáját és egyenlegét?")) return;
    addLog("Összes bot nullázása folyamatban...", "warn");
    try {
      // Reset backend state first, then reload from server
      const result = await apiFetch<{ success: boolean; stopped: number }>("/bots/reset-all", {
        method: "POST",
      });
      toast.success(`Minden bot nullázva! (${result.stopped} bot leállítva)`);
      // Force clear all UI state immediately, then do a clean reload
      setBots((prev) => prev.map((b) => ({ ...b, history: [] as TradeResult[] })));
      // Reset prevBotsRef so loadBots doesn't try to diff against stale data
      prevBotsRef.current = [];
      // Small delay to let the backend commit the transaction
      await new Promise((r) => setTimeout(r, 200));
      await loadBots();
    } catch {
      toast.error("Hiba történt a tömeges reset során");
    }
  };

  const handleBulkAction = async (action: "start" | "stop") => {
    setBulkLoading(true);
    const endpoint = action === "start" ? "/bots/run-all" : "/bots/stop-all";
    try {
      const res = await apiFetch<{ success: boolean; started?: number; stopped?: number }>(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify(
            action === "start" && parsedSessionBalance !== undefined
              ? { initial_balance: parsedSessionBalance }
              : {}
          ),
        }
      );
      if (res.success) {
        const count = action === "start" ? res.started : res.stopped;
        toast.success(`Minden bot ${action === "start" ? "elindítva" : "leállítva"} (${count})`);
        addLog(`Összes bot ${action === "start" ? "indítása" : "leállítása"} sikeres.`, "success");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hiba történt";
      toast.error(msg);
    } finally {
      setBulkLoading(false);
      await loadBots();
    }
  };

  const filteredBots = useMemo(() => {
    let list = [...bots];
    if (search) list = list.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") list = list.filter((b) => b.status === statusFilter);

    list.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;
      if (sortKey === "pnl") {
        valA = a.portfolio?.total_pnl || 0;
        valB = b.portfolio?.total_pnl || 0;
      } else if (sortKey === "balance") {
        valA = a.portfolio?.balance || 0;
        valB = b.portfolio?.balance || 0;
      } else if (sortKey === "winRate") {
        valA = a.portfolio?.win_rate || 0;
        valB = b.portfolio?.win_rate || 0;
      } else if (sortKey === "trades") {
        valA = a.portfolio?.total_trades || 0;
        valB = b.portfolio?.total_trades || 0;
      } else if (sortKey === "roi") {
        valA = a.portfolio?.roi_percent || 0;
        valB = b.portfolio?.roi_percent || 0;
      } else if (sortKey === "name")
        return sortDir === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      return sortDir === "desc" ? valB - valA : valA - valB;
    });

    if (quickFilter === "best3")
      return [...list]
        .sort((a, b) => (b.portfolio?.total_pnl || 0) - (a.portfolio?.total_pnl || 0))
        .slice(0, 3);
    if (quickFilter === "worst3")
      return [...list]
        .sort((a, b) => (a.portfolio?.total_pnl || 0) - (b.portfolio?.total_pnl || 0))
        .slice(0, 3);
    return list;
  }, [bots, search, statusFilter, sortKey, sortDir, quickFilter]);

  const totalStats = {
    total: bots.length,
    active: bots.filter((b) => b.status === "running").length,
    error: bots.filter((b) => b.status === "error").length,
    pnl: bots.reduce((a, b) => a + (b.portfolio?.total_pnl || 0), 0),
    balance: bots.reduce((a, b) => a + (b.portfolio?.balance || 0), 0),
    initial: bots.reduce((a, b) => a + (b.portfolio?.initial_balance || 0), 0),
    trades: bots.reduce((a, b) => a + (b.portfolio?.total_trades || 0), 0),
    wins: bots.reduce((a, b) => a + (b.portfolio?.winning_trades || 0), 0),
    losses: bots.reduce((a, b) => a + (b.portfolio?.losing_trades || 0), 0),
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header with Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10">
            <BotIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Bot Fleet Manager</h1>
              {serverOnline ? (
                <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-green-400 border border-green-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  ONLINE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/20">
                  <WifiOff className="h-3 w-3" />
                  OFFLINE
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500">
              {bots.length} bot &middot; {totalStats.active} aktív
              {totalStats.error > 0 && (
                <span className="ml-2 text-red-400">{totalStats.error} hibás</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk Actions Toolbar */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900/80 p-1.5 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => handleBulkAction("start")}
              disabled={bulkLoading || bots.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" />
              Indít mind
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction("stop")}
              disabled={bulkLoading || totalStats.active === 0}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
            >
              <Square className="h-3.5 w-3.5" />
              Leállít mind
            </button>
            <div className="h-5 w-px bg-white/10" />
            <button
              type="button"
              onClick={handleResetAll}
              disabled={bulkLoading || bots.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Nulláz mind
            </button>
            <div className="h-5 w-px bg-white/10" />
            <button
              type="button"
              onClick={loadBots}
              disabled={isSyncing}
              className="flex items-center justify-center rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              title="Frissítés"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Új bot
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Aktív"
          value={`${totalStats.active}/${totalStats.total}`}
          icon={<Activity className="h-4 w-4" />}
          color="green"
        />
        <StatCard
          label="Össz. PnL"
          value={`$${totalStats.pnl.toFixed(2)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          color={totalStats.pnl >= 0 ? "green" : "red"}
        />
        <StatCard
          label="Trade-ek"
          value={totalStats.trades}
          icon={<BarChart3 className="h-4 w-4" />}
          color="blue"
        />
        <StatCard
          label="Egyenleg"
          value={`$${totalStats.balance.toFixed(2)}`}
          icon={<Wallet className="h-4 w-4" />}
          color="indigo"
        />
        <StatCard
          label="Win Rate"
          value={`${totalStats.trades > 0 ? ((totalStats.wins / totalStats.trades) * 100).toFixed(1) : 0}%`}
          icon={<Trophy className="h-4 w-4" />}
          color="amber"
        />
        <StatCard
          label="W / L"
          value={`${totalStats.wins} / ${totalStats.losses}`}
          icon={<Shield className="h-4 w-4" />}
          color="violet"
        />
      </div>

      {/* Filters + Quick Actions */}
      <div className="space-y-4 rounded-xl border border-white/5 bg-zinc-900/50 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Bot keresése..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-800/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex rounded-lg border border-white/10 bg-zinc-800/30 p-1">
            {(["all", "running", "stopped", "error"] as const).map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  statusFilter === f
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {f === "all"
                  ? "Összes"
                  : f === "running"
                    ? `Aktív (${bots.filter((b) => b.status === "running").length})`
                    : f === "stopped"
                      ? "Leállítva"
                      : `Hiba (${bots.filter((b) => b.status === "error").length})`}
              </button>
            ))}
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-white/10 bg-zinc-800/50 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
          >
            <option value="pnl">Profit</option>
            <option value="winRate">Win Rate</option>
            <option value="roi">ROI</option>
            <option value="balance">Egyenleg</option>
            <option value="trades">Trade-ek</option>
            <option value="name">Név</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-zinc-800/50 text-zinc-400 transition-colors hover:text-white hover:border-white/20"
          >
            <ArrowUpDown
              className={`h-4 w-4 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-all ${
              showFilters || quickFilter !== "none"
                ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                : "border-white/10 bg-zinc-800/50 text-zinc-400 hover:text-white"
            }`}
          >
            <Filter className="h-4 w-4" />
            Gyorsszűrők
            <ChevronDown
              className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/5"
            >
              <span className="text-xs text-zinc-500">Gyors nézet:</span>
              <button
                type="button"
                onClick={() => setQuickFilter(quickFilter === "best3" ? "none" : "best3")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  quickFilter === "best3"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-zinc-800/50 text-zinc-400 border border-white/5 hover:text-white"
                }`}
              >
                <Trophy className="h-3 w-3" />
                Top 3
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter(quickFilter === "worst3" ? "none" : "worst3")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  quickFilter === "worst3"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-zinc-800/50 text-zinc-400 border border-white/5 hover:text-white"
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                Worst 3
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session Start Panel */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Play className="h-3.5 w-3.5 text-green-400" />
            <span className="font-semibold uppercase tracking-wider">Session Start</span>
          </div>
          <span className="rounded-md bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
            demo
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Balance"
            value={sessionBalance}
            onChange={(e) => setSessionBalance(e.target.value)}
            className="w-20 rounded-lg border border-white/10 bg-zinc-800/50 px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50"
          />
          {parsedSessionBalance === undefined && (
            <span className="text-xs text-red-400">Adj meg pozitív balance értéket.</span>
          )}

          {/* Timer presets */}
          {!sessionTimer && (
            <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Timer:
              </span>
              {[15, 30, 60, 120, 240].map((mins) => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => handleStartTimedSession(mins)}
                  disabled={timerLoading}
                  className="rounded-md bg-indigo-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors disabled:opacity-40"
                  title={`${mins} perces session`}
                >
                  {mins < 60 ? `${mins}p` : `${mins / 60}h`}
                </button>
              ))}
            </div>
          )}

          {/* Active timer display */}
          {sessionTimer && (
            <div className="flex items-center gap-2 ml-2 border-l border-white/10 pl-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                <span className="font-mono text-sm font-bold text-indigo-400">
                  {formatTime(sessionTimer.remaining_secs)}
                </span>
              </div>
              <div className="w-24 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                  style={{
                    width: `${(sessionTimer.remaining_secs / sessionTimer.duration_secs) * 100}%`,
                  }}
                />
              </div>
              {sessionTimer.remaining_secs <= 300 && sessionTimer.remaining_secs > 0 && (
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 animate-pulse">
                  {Math.ceil(sessionTimer.remaining_secs / 60)}p maradt
                </span>
              )}
              <button
                type="button"
                onClick={handleCancelTimer}
                disabled={timerLoading}
                className="rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-40"
              >
                Mégse
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Session Summary Modal */}
      {sessionTimer?.status === "expired" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
          >
            <h3 className="mb-4 text-lg font-bold text-white">Session vége</h3>
            <p className="mb-4 text-sm text-zinc-400">
              A időzített session lejárt. Botok leállítva.
            </p>
            <button
              type="button"
              onClick={() => setSessionTimer(null)}
              className="w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 transition-colors"
            >
              Rendben
            </button>
          </motion.div>
        </div>
      )}

      {/* Bot Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredBots.map((bot) => (
          <BotCard
            key={bot.id}
            bot={bot}
            isExpanded={expandedBot === bot.id}
            isLoading={actionLoading === bot.id}
            onToggle={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)}
            onStart={() => handleStart(bot.id, bot.name)}
            onStop={() => handleStop(bot.id, bot.name)}
            onReset={() => handleReset(bot.id, bot.name)}
            onDelete={async () => {
              if (confirm(`Véglegesen törlöd a(z) "${bot.name}" botot?`)) {
                await apiFetch(`/bots/${bot.id}`, { method: "DELETE" });
                toast.success(`${bot.name} törölve`);
                await loadBots();
              }
            }}
          />
        ))}
      </div>

      {!initialLoadComplete && filteredBots.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      )}

      {initialLoadComplete && filteredBots.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-zinc-900/30 py-16">
          <BotIcon className="h-12 w-12 text-zinc-700 mb-4" />
          <p className="text-lg font-medium text-zinc-400">Nincs találat</p>
          <p className="text-sm text-zinc-600">
            {!serverOnline
              ? "A szerver nem elérhető. Ellenőrizd, hogy fut-e a backend."
              : authRequired
                ? "Bejelentkezés szükséges a botok megtekintéséhez."
                : bots.length === 0
                  ? "Még nincs bot létrehozva. Kattints az 'Új bot' gombra!"
                  : "Próbáld módosítani a szűrőket"}
          </p>
        </div>
      )}

      {/* Activity Log */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400">
            <ScrollText className="h-4 w-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Eseménynapló</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>Frissítve: {lastSync.toLocaleTimeString()}</span>
            {isSyncing && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
        </div>

        <div className="max-h-40 space-y-2 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2 text-xs"
            >
              <span
                className={
                  log.type === "success"
                    ? "text-green-400"
                    : log.type === "warn"
                      ? "text-amber-400"
                      : log.type === "error"
                        ? "text-red-400"
                        : "text-zinc-400"
                }
              >
                {log.msg}
              </span>
              <span className="text-zinc-600">{log.time}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="py-4 text-center text-xs text-zinc-600">Még nincs esemény...</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateBotModal
            onClose={() => {
              setShowCreateModal(false);
              setCreatePrefill(undefined);
            }}
            onSuccess={() => {
              setShowCreateModal(false);
              setCreatePrefill(undefined);
              void loadBots();
            }}
            prefill={createPrefill}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "green" | "red" | "blue" | "indigo" | "amber" | "violet";
}) {
  const colors = {
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  };

  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="mb-1 flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/20">
          {icon}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function BotCard({
  bot,
  isExpanded,
  isLoading,
  onToggle,
  onStart,
  onStop,
  onReset,
  onDelete,
}: {
  bot: Bot;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<"stats" | "trades" | null>(null);
  const pnl = bot.portfolio?.total_pnl || 0;
  const balance = bot.portfolio?.balance || 0;
  const initBal = bot.portfolio?.initial_balance || 100;
  const wins = bot.portfolio?.winning_trades || 0;
  const losses = bot.portfolio?.losing_trades || 0;
  const winRate = bot.portfolio?.win_rate || 0;
  const roi = bot.portfolio?.roi_percent || 0;
  const dd = bot.portfolio?.drawdown_percent || 0;
  const avgPnl = bot.portfolio?.avg_pnl_per_trade || 0;
  const totalTrades = bot.portfolio?.total_trades || 0;
  const strategyColor = STRATEGY_COLORS[bot.strategy_type] || "#818cf8";
  const isRunning = bot.status === "running";
  const isError = bot.status === "error";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border transition-all ${
        isRunning
          ? "border-green-500/20 bg-green-500/[0.03]"
          : isError
            ? "border-red-500/20 bg-red-500/[0.03]"
            : "border-white/5 bg-zinc-900/50"
      }`}
    >
      {/* Status indicator bar */}
      <div
        className={`h-1 rounded-t-xl ${
          isRunning
            ? "bg-gradient-to-r from-green-500 to-emerald-400"
            : isError
              ? "bg-red-500"
              : bot.status === "paused"
                ? "bg-amber-500"
                : "bg-zinc-700"
        }`}
      />

      {/* Card Header */}
      <div className="flex w-full items-center justify-between gap-3 p-4">
        <button
          onClick={onToggle}
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div
            className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${STATUS_COLORS[bot.status]} ${
              isRunning ? "animate-pulse shadow-lg shadow-green-500/50" : ""
            }`}
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{bot.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span
                className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                style={{ color: strategyColor, backgroundColor: `${strategyColor}15` }}
              >
                {bot.strategy_type}
              </span>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  bot.trading_mode === "live"
                    ? "bg-red-500/15 text-red-400 border border-red-500/20"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                }`}
              >
                {bot.trading_mode === "live" ? "LIVE" : "DEMO"}
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className={`text-lg font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
            </p>
            <p className="text-xs text-zinc-500">${balance.toFixed(2)}</p>
          </div>
          <Link
            href={`/bots/${bot.id}`}
            className="flex items-center justify-center rounded-lg bg-indigo-500/10 p-2 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
            aria-label={`${bot.name} részletek`}
            title="Bot részletek"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center justify-center rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300"
            aria-label={isExpanded ? "Részletek bezárása" : "Részletek megnyitása"}
          >
            <ChevronDown
              className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Collapsed view: Quick stats row */}
      {!isExpanded && (totalTrades > 0 || winRate > 0) && (
        <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-[10px]">
          <div className="rounded bg-zinc-800/50 px-2 py-1 text-center">
            <span className="text-zinc-500">WR</span>
            <span className="ml-1 font-medium text-white">{winRate.toFixed(0)}%</span>
          </div>
          <div className="rounded bg-zinc-800/50 px-2 py-1 text-center">
            <span className="text-zinc-500">Trades</span>
            <span className="ml-1 font-medium text-white">{totalTrades}</span>
          </div>
          <div className="rounded bg-zinc-800/50 px-2 py-1 text-center">
            <span className="text-zinc-500">ROI</span>
            <span className={`ml-1 font-medium ${roi >= 0 ? "text-green-400" : "text-red-400"}`}>
              {roi >= 0 ? "+" : ""}
              {roi.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
      {!isExpanded && isRunning && totalTrades === 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Waiting for first trading opportunity
          </div>
        </div>
      )}

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-4 space-y-3">
              {/* Performance Summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-zinc-800/30 p-2.5">
                  <span className="text-zinc-500">Kezdő egyenleg</span>
                  <p className="font-semibold text-white">${initBal.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-zinc-800/30 p-2.5">
                  <span className="text-zinc-500">Jelenlegi</span>
                  <p className="font-semibold text-white">${balance.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-zinc-800/30 p-2.5">
                  <span className="text-zinc-500">ROI</span>
                  <p className={`font-semibold ${roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {roi >= 0 ? "+" : ""}
                    {roi.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-800/30 p-2.5">
                  <span className="text-zinc-500">Max Drawdown</span>
                  <p className="font-semibold text-red-400">-{dd.toFixed(2)}%</p>
                </div>
              </div>

              {/* Mini Equity Curve */}
              {totalTrades > 0 && (
                <div>
                  <span className="mb-1.5 block text-[10px] text-zinc-500 uppercase tracking-wider">
                    Equity Curve
                  </span>
                  <MiniEquityCurve botId={Number(bot.id)} compact />
                </div>
              )}

              {/* Session info for running bots */}
              {isRunning && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-green-500/5 p-2.5 border border-green-500/10">
                    <span className="text-green-400/70">Session Trades</span>
                    <p className="font-semibold text-green-400">
                      {bot.portfolio?.total_trades ?? 0}
                      <span className="text-[10px] text-zinc-500 ml-1">
                        (W: {bot.portfolio?.winning_trades ?? 0} / L:{" "}
                        {bot.portfolio?.losing_trades ?? 0})
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-indigo-500/5 p-2.5 border border-indigo-500/10">
                    <span className="text-indigo-400/70">Time to next cycle</span>
                    <p className="font-semibold text-indigo-400">
                      {((bot.interval ?? 60000) / 1000).toFixed(0)}s
                    </p>
                  </div>
                </div>
              )}

              {/* Win Rate Bar */}
              {(wins > 0 || losses > 0) && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      Win Rate ({wins}W / {losses}L)
                    </span>
                    <span className="font-medium text-white">{winRate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${winRate}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
                    <span>Átlag PnL: ${avgPnl.toFixed(2)}</span>
                    <span>Tét: ${bot.bet_size}</span>
                  </div>
                </div>
              )}

              {/* Config */}
              <CollapsibleSection
                title="Konfiguráció"
                expanded={expandedSection === "stats"}
                onToggle={() => setExpandedSection(expandedSection === "stats" ? null : "stats")}
              >
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-zinc-800/50 p-2.5 text-center">
                    <p className="text-zinc-500 mb-0.5">Tét</p>
                    <p className="font-bold text-white">${bot.bet_size}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2.5 text-center">
                    <p className="text-red-500/70 mb-0.5">Stop Loss</p>
                    <p className="font-bold text-red-400">-{(bot.stop_loss * 100).toFixed(0)}%</p>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2.5 text-center">
                    <p className="text-green-500/70 mb-0.5">Take Profit</p>
                    <p className="font-bold text-green-400">
                      +{(bot.take_profit * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Trade History */}
              <CollapsibleSection
                title={`Legutóbbi kötések (${bot.history?.length || 0})`}
                expanded={expandedSection === "trades"}
                onToggle={() => setExpandedSection(expandedSection === "trades" ? null : "trades")}
              >
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-black/20 p-2">
                  {bot.history && bot.history.length > 0 ? (
                    bot.history.slice(0, 12).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded bg-zinc-800/50 px-2.5 py-1.5 text-xs"
                      >
                        <span className={t.win ? "text-green-400" : "text-red-400"}>
                          {t.win ? "NYERT" : "VESZTETT"}
                        </span>
                        <span className="font-mono font-medium text-white">
                          {t.win ? "+" : ""}${t.amount.toFixed(2)}
                        </span>
                        <span className="text-zinc-600">{t.time}</span>
                      </div>
                    ))
                  ) : (
                    <p className="py-3 text-center text-xs text-zinc-600">Még nincs kötés</p>
                  )}
                </div>
              </CollapsibleSection>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                {isRunning ? (
                  <button
                    type="button"
                    onClick={onStop}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    Leállít
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStart}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-500/10 py-2.5 text-sm font-semibold text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Indít
                  </button>
                )}
                <button
                  type="button"
                  onClick={onReset}
                  disabled={isLoading}
                  className="flex items-center justify-center rounded-lg bg-indigo-500/10 p-2.5 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                  title="Statisztikák nullázása"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center justify-center rounded-lg bg-red-500/10 p-2.5 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                  title="Bot törlése"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-800/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
