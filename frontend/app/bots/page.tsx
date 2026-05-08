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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BotLeaderboard } from "@/components/bot-leaderboard";
import { CreateBotModal } from "@/components/bot-creation-modal";
import { AppShell } from "@/components/layout/app-shell";
import { apiFetch } from "@/lib/utils";
import type { PortfolioResponse } from "@/types";

// ---- Típusok ----
type BotStatus = "running" | "paused" | "error" | "stopped";
type SortKey = "pnl" | "winRate" | "trades" | "balance" | "name";

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
  history?: TradeResult[];
  portfolio?: {
    balance: number;
    total_pnl: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
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
};

const STATUS_COLORS = {
  running: "bg-green-500",
  paused: "bg-amber-500",
  error: "bg-red-500",
  stopped: "bg-zinc-500",
};

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // UI State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BotStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [quickFilter, setQuickFilter] = useState<"none" | "best3" | "worst3">("none");
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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
      const data = await apiFetch<Bot[]>("/bots");
      const withPortfolio = await Promise.all(
        data.map(async (bot) => {
          try {
            const p = await apiFetch<PortfolioResponse>(`/bots/${bot.id}/portfolio`);
            return { ...bot, portfolio: p };
          } catch {
            return bot;
          }
        })
      );

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
    } catch (_err) {
      setServerOnline(false);
    } finally {
      setIsSyncing(false);
    }
  }, [addLog]);

  useEffect(() => {
    setMounted(true);
    loadBots();
    const interval = setInterval(loadBots, 15000);
    return () => clearInterval(interval);
  }, [loadBots]);

  const handleStart = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/bots/${id}/start`, { method: "POST" });
      toast.success(`${name} elindítva`);
      addLog(`${name}: Elindítva.`, "success");
      await loadBots();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hiba történt";
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/bots/${id}/stop`, { method: "POST" });
      toast.success(`${name} leállítva`);
      addLog(`${name}: Leállítva.`, "warn");
      await loadBots();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hiba történt";
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReset = async (id: string, name: string) => {
    if (!confirm(`Resetelsz minden értéket: ${name}?`)) return;
    setActionLoading(id);
    try {
      await apiFetch(`/bots/${id}/reset`, { method: "POST" });
      toast.success("Nullázva");
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
      await Promise.all(bots.map((bot) => apiFetch(`/bots/${bot.id}/reset`, { method: "POST" })));
      toast.success("Minden bot nullázva!");
      setBots((prev) => prev.map((b) => ({ ...b, history: [] })));
      await loadBots();
    } catch {
      toast.error("Hiba történt a tömeges reset során");
    }
  };

  const handleBulkAction = async (action: "start" | "stop") => {
    const targets = bots.filter((b) =>
      action === "start" ? b.status !== "running" : b.status === "running"
    );
    if (targets.length === 0) return;
    toast.promise(
      Promise.all(targets.map((b) => apiFetch(`/bots/${b.id}/${action}`, { method: "POST" }))),
      {
        loading: "Művelet folyamatban...",
        success: "Kész!",
        error: "Hiba történt",
      }
    );
    addLog(`Minden bot ${action === "start" ? "indítása" : "leállítása"}.`, "info");
    setTimeout(loadBots, 2000);
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
    active: bots.filter((b) => b.status === "running").length,
    pnl: bots.reduce((a, b) => a + (b.portfolio?.total_pnl || 0), 0),
    balance: bots.reduce((a, b) => a + (b.portfolio?.balance || 0), 0),
    trades: bots.reduce((a, b) => a + (b.portfolio?.total_trades || 0), 0),
    wins: bots.reduce((a, b) => a + (b.portfolio?.winning_trades || 0), 0),
    losses: bots.reduce((a, b) => a + (b.portfolio?.losing_trades || 0), 0),
  };

  if (!mounted) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10">
              <BotIcon className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Bot Fleet Manager</h1>
              <p className="text-sm text-zinc-500">
                {bots.length} bot · {totalStats.active} aktív
              </p>
            </div>
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

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <StatCard
            label="Aktív Botok"
            value={totalStats.active}
            icon={<Activity className="h-4 w-4" />}
            color="green"
          />
          <StatCard
            label="Összes PnL"
            value={`$${totalStats.pnl.toFixed(2)}`}
            icon={<TrendingUp className="h-4 w-4" />}
            color={totalStats.pnl >= 0 ? "green" : "red"}
          />
          <StatCard
            label="Összes Trade"
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
            value={`${bots.length > 0 ? ((totalStats.wins / (totalStats.wins + totalStats.losses)) * 100 || 0).toFixed(1) : 0}%`}
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

        {/* Competition Leaderboard */}
        <BotLeaderboard />

        {/* Filters */}
        <div className="space-y-4 rounded-xl border border-white/5 bg-zinc-900/50 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
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

            {/* Status Filters */}
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
                      ? `● Aktív (${bots.filter((b) => b.status === "running").length})`
                      : f === "stopped"
                        ? `■ Leállítva`
                        : `✕ Hiba`}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-white/10 bg-zinc-800/50 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
            >
              <option value="pnl">Profit</option>
              <option value="winRate">Win Rate</option>
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

            {/* Quick filters toggle */}
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

          {/* Quick filters panel */}
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
                  Top 3 Legjobb
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
                  Top 3 Legrosszabb
                </button>

                <div className="h-4 w-px bg-white/10 mx-2" />

                <button
                  type="button"
                  onClick={handleBulkAction.bind(null, "start")}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                >
                  <Play className="h-3 w-3" />
                  Indít mind
                </button>
                <button
                  type="button"
                  onClick={handleBulkAction.bind(null, "stop")}
                  className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                >
                  <Square className="h-3 w-3" />
                  Megállít mind
                </button>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Összes nullázása
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
              onDelete={() => {
                if (confirm("Végleges törlés?"))
                  apiFetch(`/bots/${bot.id}`, { method: "DELETE" }).then(loadBots);
              }}
            />
          ))}
        </div>

        {filteredBots.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-zinc-900/30 py-16">
            <BotIcon className="h-12 w-12 text-zinc-700 mb-4" />
            <p className="text-lg font-medium text-zinc-400">Nincs találat</p>
            <p className="text-sm text-zinc-600">Próbáld módosítani a szűrőket</p>
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
              {serverOnline ? (
                <span className="flex items-center gap-1.5 text-green-500">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  ONLINE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-500">
                  <WifiOff className="h-3 w-3" />
                  OFFLINE
                </span>
              )}
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
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateBotModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              void loadBots();
            }}
          />
        )}
      </AnimatePresence>
    </AppShell>
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
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/20">
          {icon}
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-current/60">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
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
  const pnl = bot.portfolio?.total_pnl || 0;
  const balance = bot.portfolio?.balance || 0;
  const wins = bot.portfolio?.winning_trades || 0;
  const losses = bot.portfolio?.losing_trades || 0;
  const winRate = bot.portfolio?.win_rate || 0;
  const strategyColor = STRATEGY_COLORS[bot.strategy_type] || "#818cf8";
  const isRunning = bot.status === "running";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border transition-all ${
        isRunning ? "border-green-500/20 bg-green-500/5" : "border-white/5 bg-zinc-900/50"
      }`}
    >
      {/* Card Header */}
      <button
        onClick={onToggle}
        type="button"
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`h-3 w-3 rounded-full flex-shrink-0 ${STATUS_COLORS[bot.status]} ${
              isRunning ? "animate-pulse shadow-lg shadow-green-500/50" : ""
            }`}
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{bot.name}</h3>
            <span
              className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
              style={{ color: strategyColor, backgroundColor: `${strategyColor}15` }}
            >
              {bot.strategy_type}
            </span>
            <span
              className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                bot.trading_mode === "live"
                  ? "bg-red-500/15 text-red-400 border border-red-500/20"
                  : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
              }`}
            >
              {bot.trading_mode === "live" ? "LIVE" : "DEMO"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className={`text-lg font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
            </p>
            <p className="text-xs text-zinc-500">${balance.toFixed(2)}</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="space-y-4 p-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                  <p className="text-[10px] uppercase text-zinc-500 mb-1">Tét</p>
                  <p className="text-sm font-bold text-white">${bot.bet_size}</p>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                  <p className="text-[10px] uppercase text-red-500/70 mb-1">Stop Loss</p>
                  <p className="text-sm font-bold text-red-400">
                    -{(bot.stop_loss * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                  <p className="text-[10px] uppercase text-green-500/70 mb-1">Take Profit</p>
                  <p className="text-sm font-bold text-green-400">
                    +{(bot.take_profit * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Win Rate Bar */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Win Rate</span>
                  <span className="font-medium text-white">{winRate.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${winRate}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  {wins} nyert / {losses} vesztett
                </p>
              </div>

              {/* Recent Trades */}
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">Legutóbbi kötések</p>
                <div className="max-h-24 space-y-1.5 overflow-y-auto rounded-lg bg-black/20 p-2">
                  {bot.history && bot.history.length > 0 ? (
                    bot.history.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded bg-zinc-800/50 px-2 py-1 text-xs"
                      >
                        <span className={t.win ? "text-green-400" : "text-red-400"}>
                          {t.win ? "✅ NYERT" : "❌ VESZTETT"}
                        </span>
                        <span className="font-mono font-medium text-white">
                          ${t.amount.toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-center text-[10px] text-zinc-600">Még nincs kötés...</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
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
