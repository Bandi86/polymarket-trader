"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot as BotIcon,
  Clock,
  Loader2,
  Play,
  RotateCcw,
  Square,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import type { PortfolioResponse } from "@/types";

interface Trade {
  id: number;
  bot_id: number;
  market_slug: string;
  outcome: string;
  signal_confidence: number;
  btc_price: number | null;
  yes_price: number | null;
  no_price: number | null;
  time_remaining: number | null;
  decision_reason: string;
  created_at: string;
  pnl: number | null;
}

interface BotDetail {
  id: number;
  name: string;
  market_id: string;
  strategy_type: string;
  params: string;
  status: string;
  created_at: string;
  bet_size: number;
  use_kelly: boolean;
  kelly_fraction: number;
  max_bet: number;
  interval: number;
  stop_loss: number;
  take_profit: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  trading_mode: string;
  portfolio: PortfolioResponse | null;
}

interface Session {
  session_id: number;
  bot_id: number;
  status: string;
  start_time: string;
  end_time: string | null;
  start_balance: number;
  end_balance: number | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  max_drawdown: number;
}

export default function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  if (!id) return null;
  return <BotDetail id={id} />;
}

function BotDetail({ id }: { id: string }) {
  const [bot, setBot] = useState<BotDetail | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"trades" | "sessions" | "config">("trades");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [botData, tradesData, sessionsData, portfolioData] = await Promise.all([
        apiFetch<BotDetail>(`/bots/${id}`).catch(() => null),
        apiFetch<Trade[]>(`/bots/${id}/trades`).catch(() => [] as Trade[]),
        apiFetch<Session[]>(`/bots/${id}/history`).catch(() => [] as Session[]),
        apiFetch<PortfolioResponse>(`/bots/${id}/portfolio`).catch(() => null),
      ]);
      if (botData) {
        botData.portfolio = portfolioData;
        setBot(botData);
      }
      setTrades(tradesData);
      setSessions(sessionsData);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 10000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const equityData = useMemo(() => {
    const reversed = [...trades].reverse();
    let cumulativePnl = 0;
    const points: { time: string; pnl: number }[] = [];
    for (const t of reversed) {
      if (t.pnl !== null) {
        cumulativePnl += t.pnl;
        points.push({
          time: new Date(t.created_at).toLocaleTimeString(),
          pnl: cumulativePnl,
        });
      }
    }
    return points;
  }, [trades]);

  const stats = useMemo(() => {
    const wins = trades.filter((t) => t.pnl !== null && t.pnl > 0).length;
    const losses = trades.filter((t) => t.pnl !== null && t.pnl <= 0).length;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    return { wins, losses, totalPnl, total: trades.length };
  }, [trades]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch<{ success: boolean }>(`/bots/${id}/start`, {
        method: "POST",
        body: JSON.stringify({ initial_balance: 100 }),
      });
      if (res.success) {
        toast.success("Bot elindítva");
        await loadAll();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch<{ success: boolean }>(`/bots/${id}/stop`, { method: "POST" });
      if (res.success) {
        toast.success("Bot leállítva");
        await loadAll();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Biztosan nullázod a statisztikákat?")) return;
    setActionLoading(true);
    try {
      await apiFetch(`/bots/${id}/reset`, { method: "POST" });
      toast.success("Statisztikák nullázva");
      await loadAll();
    } catch {
      toast.error("Backend hiba");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Véglegesen törlöd ezt a botot?")) return;
    await apiFetch(`/bots/${id}`, { method: "DELETE" });
    toast.success("Bot törölve");
    window.location.href = "/bots";
  };

  if (loading && !bot) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-500">
        <BotIcon className="h-16 w-16 mb-4" />
        <p className="text-lg font-medium">Bot nem található</p>
        <Link href="/bots" className="mt-4 text-indigo-400 hover:underline text-sm">
          ← Vissza a botokhoz
        </Link>
      </div>
    );
  }

  const isRunning = bot.status === "running";
  const pnl = bot.portfolio?.total_pnl ?? stats.totalPnl;
  const balance = bot.portfolio?.balance ?? 0;
  const roi = bot.portfolio?.roi_percent ?? 0;
  const dd = bot.portfolio?.drawdown_percent ?? 0;
  const wr = bot.portfolio?.win_rate ?? 0;
  const totalTrades = bot.portfolio?.total_trades ?? stats.total;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/bots"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{bot.name}</h1>
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                  isRunning
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                }`}
              >
                {isRunning ? "FUT" : "LEÁLLÍTVA"}
              </span>
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                  bot.trading_mode === "live"
                    ? "bg-red-500/15 text-red-400 border border-red-500/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}
              >
                {bot.trading_mode === "live" ? "LIVE" : "DEMO"}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {bot.strategy_type} &middot; Létrehozva:{" "}
              {new Date(bot.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Leállít
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-green-500/15 px-4 py-2.5 text-sm font-semibold text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Indít
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            disabled={actionLoading}
            className="flex items-center justify-center rounded-lg bg-indigo-500/10 p-2.5 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center justify-center rounded-lg bg-red-500/10 p-2.5 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            title="Törlés"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat
          label="Egyenleg"
          value={`$${balance.toFixed(2)}`}
          icon={<Wallet className="h-4 w-4" />}
          color="indigo"
        />
        <Stat
          label="Össz. PnL"
          value={`${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          color={pnl >= 0 ? "green" : "red"}
        />
        <Stat
          label="ROI"
          value={`${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`}
          icon={<Activity className="h-4 w-4" />}
          color={roi >= 0 ? "green" : "red"}
        />
        <Stat
          label="Win Rate"
          value={`${wr.toFixed(1)}%`}
          icon={<Trophy className="h-4 w-4" />}
          color="amber"
        />
        <Stat
          label="Trade-ek"
          value={String(totalTrades)}
          icon={<BarChart3 className="h-4 w-4" />}
          color="blue"
        />
        <Stat
          label="W / L"
          value={`${bot.portfolio?.winning_trades ?? stats.wins} / ${bot.portfolio?.losing_trades ?? stats.losses}`}
          icon={<Target className="h-4 w-4" />}
          color="violet"
        />
        <Stat
          label="Max DD"
          value={`${dd.toFixed(2)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={dd > 10 ? "red" : "amber"}
        />
      </div>

      {/* Equity Curve */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Equity görbe (halmozott PnL)</h3>
        {equityData.length >= 2 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#a1a1aa" }}
                />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fill="url(#pnlGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
            Még nincs elég trade az equity görbéhez
          </div>
        )}
      </div>

      {/* Tabs: Trades / Sessions / Config */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/50 backdrop-blur-sm overflow-hidden">
        <div className="flex border-b border-white/5">
          {(["trades", "sessions", "config"] as const).map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab === "trades" && "Kötések"}
              {tab === "sessions" && "Sessiók"}
              {tab === "config" && "Konfiguráció"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "trades" && (
            <div className="space-y-2">
              {trades.length === 0 ? (
                <p className="text-center text-sm text-zinc-600 py-8">Még nincs kötés</p>
              ) : (
                trades.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                          t.outcome === "YES"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {t.outcome}
                      </span>
                      <div>
                        <p className="text-zinc-300 text-xs">{t.market_slug.slice(0, 25)}...</p>
                        <p className="text-zinc-600 text-[10px]">
                          {t.decision_reason.slice(0, 60)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      {t.signal_confidence > 0 && (
                        <span className="text-zinc-500">
                          {(t.signal_confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      {t.pnl !== null && (
                        <span
                          className={`font-mono font-semibold ${
                            t.pnl >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                        </span>
                      )}
                      <span className="text-zinc-600">
                        {new Date(t.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "sessions" && (
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-center text-sm text-zinc-600 py-8">Még nincs session</p>
              ) : (
                sessions.map((s) => {
                  const sessionPnl = (s.end_balance ?? s.start_balance) - s.start_balance;
                  return (
                    <div
                      key={s.session_id}
                      className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-zinc-500" />
                        <div>
                          <p className="text-zinc-300 text-xs">
                            #{s.session_id} &middot; {new Date(s.start_time).toLocaleDateString()}{" "}
                            {new Date(s.start_time).toLocaleTimeString()}
                          </p>
                          <p className="text-zinc-600 text-[10px]">
                            #{s.total_trades} trade ({s.winning_trades}W/{s.losing_trades}L)
                            &middot; DD: {(s.max_drawdown * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-zinc-500">
                          ${s.start_balance.toFixed(0)} → ${(s.end_balance ?? 0).toFixed(0)}
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            sessionPnl >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "config" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <ConfigItem label="Stratégia" value={bot.strategy_type} />
              <ConfigItem label="Piaci ID" value={bot.market_id.slice(0, 20)} />
              <ConfigItem label="Tét" value={`$${bot.bet_size}`} />
              <ConfigItem label="Max tét" value={`$${bot.max_bet}`} />
              <ConfigItem
                label="Kelly"
                value={bot.use_kelly ? `${(bot.kelly_fraction * 100).toFixed(0)}%` : "Nem"}
              />
              <ConfigItem label="Interval" value={`${(bot.interval / 1000).toFixed(0)}s`} />
              <ConfigItem label="Stop Loss" value={`-${(bot.stop_loss * 100).toFixed(0)}%`} />
              <ConfigItem label="Take Profit" value={`+${(bot.take_profit * 100).toFixed(0)}%`} />
              <ConfigItem label="Paraméterek" value={bot.params || "{}"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "green" | "red" | "indigo" | "amber" | "blue" | "violet";
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
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/20">
          {icon}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-800/30 p-3">
      <p className="text-[10px] uppercase text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-white truncate">{value}</p>
    </div>
  );
}
