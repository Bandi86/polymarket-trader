"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Beaker,
  Bot as BotIcon,
  Clock,
  FlaskConical,
  Loader2,
  Play,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CreateBotModal } from "@/components/bot-creation-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { GlassCard } from "@/components/ui/glass-card";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { StatCard } from "@/components/ui/stat-card";
import { apiFetch, formatTime } from "@/lib/utils";
import type { StrategyType } from "@/types";

type StrategyInfo = {
  id: string;
  name: string;
  description: string;
  params: string[];
};

type TestSignal = {
  side: string;
  confidence: number;
  reason: string;
};

type TestResult = {
  id: number;
  strategy_type: string;
  market_id: string;
  status: string;
  initial_balance: number;
  final_balance: number;
  signal: TestSignal;
  total_trades: number;
  total_pnl: number;
};

type Performance = {
  initial_balance: number;
  final_balance: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  roi: number;
};

type TestEvent = {
  intents: Array<{
    id: number;
    side: string;
    strategy_type: string;
    confidence: number;
    reason: string;
    status: string;
    snapshot_json: string;
    created_at: string;
  }>;
  executions: Array<{
    id: number;
    side: string;
    status: string;
    filled_size: number;
    avg_fill_price: number;
    error_code: string | null;
    created_at: string;
  }>;
};

const STRATEGY_COLORS: Record<string, string> = {
  momentum: "#8b5cf6",
  mean_reversion: "#06b6d4",
  trend: "#10b981",
  volatility: "#f59e0b",
  sniper: "#ef4444",
  contrarian: "#ec4899",
  binance_velocity: "#6366f1",
  fair_value: "#14b8a6",
  oracle_lag: "#a855f7",
  window_delta: "#3b82f6",
};

export default function StrategyLabPage() {
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("momentum");
  const [marketId, setMarketId] = useState<string>("");
  const [initialBalance, setInitialBalance] = useState<number>(100);

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [testEvents, setTestEvents] = useState<TestEvent | null>(null);

  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [runningTest, setRunningTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<StrategyType | null>(null);
  const router = useRouter();

  const fetchStrategies = useCallback(async () => {
    try {
      const data = await apiFetch<{ strategies: StrategyInfo[] }>("/strategies");
      setStrategies(data.strategies);
    } catch {
      // fallback strategies
      setStrategies([
        { id: "momentum", name: "BTC Momentum", description: "BTC momentum alapú", params: [] },
        { id: "mean_reversion", name: "Mean Reversion", description: "Visszatérés", params: [] },
      ]);
    } finally {
      setLoadingStrategies(false);
    }
  }, []);

  useEffect(() => {
    void fetchStrategies();
  }, [fetchStrategies]);

  const runTest = async () => {
    if (!marketId.trim()) {
      toast.error("Market ID kötelező");
      return;
    }

    setRunningTest(true);
    setError(null);
    setTestResult(null);
    setPerformance(null);
    setTestEvents(null);

    try {
      const result = await apiFetch<TestResult>("/strategy-tests", {
        method: "POST",
        body: JSON.stringify({
          strategy_type: selectedStrategy,
          market_id: marketId,
          initial_balance: initialBalance,
          mode: "demo",
        }),
      });

      setTestResult(result);
      toast.success(`Test kész: ${result.signal.side} signal`);

      try {
        const perf = await apiFetch<Performance>(`/strategy-tests/${result.id}/performance`);
        setPerformance(perf);
      } catch {
        // optional
      }

      try {
        const events = await apiFetch<TestEvent>(`/strategy-tests/${result.id}/events`);
        setTestEvents(events);
      } catch {
        // optional
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Test sikertelen";
      setError(msg);
      toast.error(msg);
    } finally {
      setRunningTest(false);
    }
  };

  const getStrategyColor = (id: string) => STRATEGY_COLORS[id] ?? "#6366f1";
  const getSignalIcon = (side: string) => {
    if (side === "YES") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
    if (side === "NO") return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Activity className="h-4 w-4 text-zinc-400" />;
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="ambient-glow ambient-glow-primary absolute"
        style={{ width: 500, height: 500, top: "10%", left: "20%" }}
      />

      <div className="max-w-6xl mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
              <FlaskConical className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Strategy Lab</h1>
              <p className="text-xs text-zinc-500">Stratégia tesztelés valós piaci adatokkal</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Controls */}
          <div className="space-y-4">
            {/* Strategy Selector */}
            <GlassCard animate className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Beaker className="h-4 w-4 text-violet-500" />
                <h2 className="text-sm font-semibold text-zinc-300">Stratégia választás</h2>
              </div>

              {loadingStrategies ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <SkeletonCard key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {strategies.map((strategy) => (
                    <button
                      key={strategy.id}
                      type="button"
                      onClick={() => setSelectedStrategy(strategy.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                        selectedStrategy === strategy.id
                          ? "border-violet-500/40 bg-violet-500/10"
                          : "border-white/8 bg-white/5 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-sm font-medium"
                          style={{ color: getStrategyColor(strategy.id) }}
                        >
                          {strategy.name}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{strategy.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Run Test Form */}
            <GlassCard animate className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Play className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-zinc-300">Teszt futtatása</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="market-id-input" className="text-xs text-zinc-500 mb-1.5 block">
                    Market ID
                  </label>
                  <input
                    type="text"
                    id="market-id-input"
                    value={marketId}
                    onChange={(e) => setMarketId(e.target.value)}
                    placeholder="pl. btc-updown-5m-1234567890"
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-violet-500/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="initial-balance-input"
                    className="text-xs text-zinc-500 mb-1.5 block"
                  >
                    Kezdő egyenleg ($)
                  </label>
                  <input
                    type="number"
                    id="initial-balance-input"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(Number(e.target.value))}
                    min={1}
                    max={10000}
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500/40"
                  />
                </div>

                <button
                  type="button"
                  onClick={runTest}
                  disabled={runningTest || !marketId.trim()}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    runningTest || !marketId.trim()
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/50 cursor-not-allowed"
                      : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                  }`}
                >
                  {runningTest ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Futtatás...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Teszt futtatása
                    </>
                  )}
                </button>
              </div>
            </GlassCard>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-2 space-y-4">
            {error && <ErrorState title="Teszt sikertelen" description={error} onRetry={runTest} />}

            {testResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <GlassCard animate className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <h2 className="text-sm font-semibold text-zinc-300">Legutóbbi eredmény</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTestResult(null)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div
                    className={`rounded-xl border p-4 mb-4 ${
                      testResult.signal.side === "YES"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : testResult.signal.side === "NO"
                          ? "bg-red-500/10 border-red-500/30"
                          : "bg-zinc-500/10 border-zinc-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {getSignalIcon(testResult.signal.side)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-zinc-100">
                            {testResult.signal.side}
                          </span>
                          <span className="text-sm text-zinc-400">
                            {(testResult.signal.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 mt-0.5">{testResult.signal.reason}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Stratégia", value: testResult.strategy_type },
                      { label: "Market", value: testResult.market_id },
                      { label: "Kezdő", value: `$${testResult.initial_balance}` },
                      {
                        label: "Végző",
                        value: `$${testResult.final_balance.toFixed(2)}`,
                        color:
                          testResult.final_balance >= testResult.initial_balance
                            ? "text-emerald-400"
                            : "text-red-400",
                      },
                    ].map((item) => (
                      <div key={item.label} className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-zinc-500 mb-1">{item.label}</p>
                        <p
                          className={`text-sm font-medium ${item.color ?? "text-zinc-200"} truncate`}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  {/* Create Bot CTA */}
                  <button
                    type="button"
                    onClick={() => {
                      setPendingStrategy(selectedStrategy as StrategyType);
                      setShowCreateModal(true);
                    }}
                    className="mt-4 w-full rounded-xl bg-indigo-500/15 border border-indigo-500/30 py-2.5 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/25 transition-colors flex items-center justify-center gap-2"
                  >
                    <BotIcon className="h-4 w-4" />
                    Bot létrehozása ezzel a stratégiával
                  </button>
                </GlassCard>
              </motion.div>
            )}

            {performance && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <GlassCard animate className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-cyan-500" />
                    <h2 className="text-sm font-semibold text-zinc-300">Teljesítmény metrikák</h2>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <StatCard
                      label="Win Rate"
                      value={performance.win_rate * 100}
                      format="percent"
                      icon={<Trophy className="h-4 w-4" />}
                    />
                    <StatCard
                      label="Összes P&L"
                      value={performance.total_pnl}
                      format="pnl"
                      icon={<TrendingUp className="h-4 w-4" />}
                    />
                    <StatCard
                      label="ROI"
                      value={performance.roi * 100}
                      format="percent"
                      icon={<BarChart3 className="h-4 w-4" />}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                    {[
                      {
                        label: "Nyertesek",
                        value: performance.winning_trades,
                        color: "text-emerald-400",
                      },
                      {
                        label: "Veszteségek",
                        value: performance.losing_trades,
                        color: "text-red-400",
                      },
                      {
                        label: "Összes trade",
                        value: performance.total_trades,
                        color: "text-zinc-200",
                      },
                      {
                        label: "Kezdő egyenleg",
                        value: `$${performance.initial_balance}`,
                        color: "text-zinc-200",
                      },
                      {
                        label: "Végző egyenleg",
                        value: `$${performance.final_balance.toFixed(2)}`,
                        color:
                          performance.final_balance >= performance.initial_balance
                            ? "text-emerald-400"
                            : "text-red-400",
                      },
                    ].map((item) => (
                      <div key={item.label} className="p-2 rounded-lg bg-white/5 text-center">
                        <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-[10px] text-zinc-500">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {testEvents && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <GlassCard animate className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-4 w-4 text-violet-500" />
                    <h2 className="text-sm font-semibold text-zinc-300">Esemény timeline</h2>
                  </div>

                  {testEvents.intents.length === 0 && testEvents.executions.length === 0 ? (
                    <EmptyState title="Nincs esemény" description="Események megjelennek ide" />
                  ) : (
                    <div className="space-y-4">
                      {testEvents.intents.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                            Trade döntések
                          </h3>
                          <div className="space-y-2">
                            {testEvents.intents.map((intent) => (
                              <div
                                key={intent.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/8"
                              >
                                <div className="flex items-center gap-3">
                                  {getSignalIcon(intent.side)}
                                  <div>
                                    <p className="text-sm font-medium text-zinc-200">
                                      {intent.side}{" "}
                                      <span className="text-zinc-500">
                                        ({intent.strategy_type})
                                      </span>
                                    </p>
                                    <p className="text-xs text-zinc-500">{intent.reason}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p
                                    className={`text-xs font-medium ${
                                      intent.confidence >= 0.7
                                        ? "text-emerald-400"
                                        : intent.confidence >= 0.5
                                          ? "text-amber-400"
                                          : "text-zinc-400"
                                    }`}
                                  >
                                    {(intent.confidence * 100).toFixed(0)}%
                                  </p>
                                  <p className="text-xs text-zinc-600">{intent.status}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {testEvents.executions.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                            Végrehajtások
                          </h3>
                          <div className="space-y-2">
                            {testEvents.executions.map((exec) => (
                              <div
                                key={exec.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/8"
                              >
                                <div className="flex items-center gap-3">
                                  {getSignalIcon(exec.side)}
                                  <div>
                                    <p className="text-sm font-medium text-zinc-200">
                                      {exec.side} — {exec.filled_size.toFixed(4)} @ $
                                      {exec.avg_fill_price.toFixed(4)}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                      {exec.status}
                                      {exec.error_code && ` — ${exec.error_code}`}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-xs text-zinc-500">
                                  {formatTime(new Date(exec.created_at))}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            )}

            {!testResult && !performance && !testEvents && !error && (
              <GlassCard animate className="p-12 flex flex-col items-center justify-center">
                <FlaskConical className="h-10 w-10 text-zinc-700 mb-4" />
                <h3 className="text-base font-semibold text-zinc-400 mb-1">Tesztelésre kész</h3>
                <p className="text-sm text-zinc-600 text-center">
                  Válassz stratégiát, add meg a Market ID-t és indítsd el a tesztet
                </p>
              </GlassCard>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateBotModal
            onClose={() => setShowCreateModal(false)}
            prefill={{
              strategy: pendingStrategy ?? "momentum",
              name: `Test-${selectedStrategy}-${Date.now()}`,
            }}
            onSuccess={(botId) => {
              router.push(`/bots?id=${botId}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
