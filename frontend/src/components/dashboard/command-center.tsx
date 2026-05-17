"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot as BotIcon,
  Clock,
  History,
  LineChart,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ActivityTabs } from "@/components/dashboard/activity-tabs";
import { BacktestResults } from "@/components/dashboard/backtest-results";
import { BotSelector } from "@/components/dashboard/bot-selector";
import { BotThoughts } from "@/components/dashboard/bot-thoughts";
import { ChartPanel } from "@/components/dashboard/chart-panel";
import { EquityCurve } from "@/components/dashboard/equity-curve";
import { ExportData } from "@/components/dashboard/export-data";
import { MarketHistory } from "@/components/dashboard/market-history";
import { MarketTransitionAlert } from "@/components/dashboard/market-transition-alert";
import { PendingBetMonitor } from "@/components/dashboard/pending-bet-monitor";
import { QuickStart } from "@/components/dashboard/quick-start";
import { QuickTradePanel } from "@/components/dashboard/quick-trade-panel";
import { StrategyComparisonTable } from "@/components/dashboard/strategy-comparison-table";
import { StrategyPerformance } from "@/components/dashboard/strategy-performance";
import { SystemHealth } from "@/components/dashboard/system-health";
import { TradeFeed } from "@/components/dashboard/trade-feed";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { useAggregatePortfolio, useSettings, useUserBalance } from "@/hooks";
import { useAppStore } from "@/store";

// Compact Account Info - Always visible, single row
function AccountInfoBar() {
  const { userBalance, latency, tradingMode } = useAppStore();
  const { data: balanceData } = useUserBalance();
  const { data: agg, isLoading: aggLoading } = useAggregatePortfolio();

  const balance = balanceData?.balance ?? userBalance;
  const hasCredentials = balanceData?.has_credentials ?? false;

  // Demo mode: show aggregate bot balance instead of wallet balance
  const isDemo = tradingMode === "demo";
  const demoBalance = agg?.total_balance ?? 0;
  const demoInitial = agg?.total_initial ?? 0;
  const demoPnl = agg?.total_pnl ?? 0;
  const demoHasTrades = (agg?.total_trades ?? 0) > 0;

  // Latency sparkline data (last 20 samples)
  const sparkline = latency.samples.slice(-20);
  const maxSpark = Math.max(...sparkline, 1);

  return (
    <div
      className={`rounded-xl border backdrop-blur-xl px-4 py-3 ${
        isDemo ? "border-indigo-500/20 bg-indigo-500/5" : "border-emerald-500/20 bg-emerald-500/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Mode badge */}
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
              isDemo ? "bg-indigo-500/20 text-indigo-400" : "bg-green-500/20 text-green-400"
            }`}
          >
            <span>{isDemo ? "🎮" : "⚡"}</span>
            <span>{isDemo ? "Demo" : "Live"}</span>
          </div>

          {/* Balance */}
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isDemo ? "bg-indigo-500/15" : "bg-emerald-500/15"
              }`}
            >
              <Wallet className={`h-5 w-5 ${isDemo ? "text-indigo-400" : "text-emerald-400"}`} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {isDemo ? "Demo Egyenleg" : "Egyenleg"}
              </span>
              <div
                className={`text-xl font-extrabold font-mono ${
                  isDemo ? "text-indigo-400" : "text-emerald-400"
                }`}
              >
                {isDemo
                  ? `$${demoBalance.toFixed(2)}`
                  : hasCredentials && typeof balance === "number"
                    ? `$${balance.toFixed(2)}`
                    : "---"}
              </div>
            </div>
          </div>

          {/* Demo: show initial balance info */}
          {isDemo && demoInitial > 0 && (
            <>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Kezdő
                </span>
                <div className="text-xl font-extrabold font-mono text-zinc-400">
                  ${demoInitial.toFixed(2)}
                </div>
              </div>
            </>
          )}

          {/* P&L Divider */}
          <div className="h-8 w-px bg-white/10" />

          {/* Aggregate P&L */}
          {!aggLoading && agg && demoHasTrades && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
                  <Activity className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {isDemo ? "Demo PnL" : "Bot P&L"}
                  </span>
                  <div
                    className={`text-xl font-extrabold font-mono ${
                      demoPnl >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {demoPnl >= 0 ? "+" : ""}${demoPnl.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-white/10" />

              {/* Win Rate */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Win Rate
                </span>
                <div className="text-xl font-extrabold font-mono text-emerald-400">
                  {agg.overall_win_rate.toFixed(1)}%
                </div>
              </div>
            </>
          )}

          {/* Demo: no trades yet message */}
          {isDemo && !demoHasTrades && (
            <span className="text-xs text-zinc-500">Indítsd el a botokat a kereskedéshez!</span>
          )}
        </div>

        <Link
          href="/settings"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-400 transition-colors flex items-center gap-1"
        >
          Beállítások
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Bottom row: P&L bar + Latency sparkline */}
      {!aggLoading && agg && demoHasTrades && (
        <div className="mt-3 flex items-center gap-4">
          {/* P&L distribution bar */}
          <div className="flex-1 flex h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            {(() => {
              const wins = agg.overall_win_rate;
              const losses = 100 - wins;
              return (
                <>
                  <div
                    className="bg-green-500/60 transition-all duration-500"
                    style={{ width: `${wins}%` }}
                  />
                  <div
                    className="bg-red-500/60 transition-all duration-500"
                    style={{ width: `${losses}%` }}
                  />
                </>
              );
            })()}
          </div>
          <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
            {agg.total_trades} trades · ${Math.abs(agg.avg_pnl_per_trade).toFixed(2)} avg
          </span>

          {/* Latency sparkline */}
          {sparkline.length > 1 && (
            <div className="flex items-center gap-1">
              <svg
                width="40"
                height="12"
                className="opacity-50"
                role="img"
                aria-label="Latency sparkline"
              >
                {sparkline.map((v, i) => {
                  const x = (i / (sparkline.length - 1)) * 40;
                  const y = 12 - (v / maxSpark) * 10;
                  return (
                    <circle
                      key={`sp-${i.toFixed(1)}-${x.toFixed(2)}`}
                      cx={x}
                      cy={y}
                      r="0.8"
                      fill={v < 50 ? "#22c55e" : v < 150 ? "#f59e0b" : "#ef4444"}
                    />
                  );
                })}
              </svg>
              <span className="text-[9px] text-zinc-600">latency</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact Market Bar - inside collapsible panel
function MarketBar() {
  const { btcPrice, startPrice, priceDelta, timeRemaining, yesPrice, noPrice, volume, latency } =
    useAppStore();

  const latencyColor =
    latency.current < 50
      ? "text-green-400"
      : latency.current < 150
        ? "text-amber-400"
        : "text-red-400";

  const isUp = priceDelta >= 0;
  const marketPrediction = yesPrice > 0.5 ? "EXCEED" : "STAY BELOW";

  const formatTime = (secs: number) => {
    if (secs <= 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const formatPrice = (p: number) => {
    if (!p || p <= 0) return "---";
    return p.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatDelta = (d: number) => {
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d.toFixed(0)}`;
  };

  const marketDuration = 300;

  // Probability Arc — mini SVG showing YES probability as arc fill
  function ProbabilityArc({ yesPrice }: { yesPrice: number }) {
    const radius = 18;
    const circumference = Math.PI * radius; // half-circle
    const fillPercent = Math.min(Math.max(yesPrice * 100, 2), 98);
    const offset = circumference - (fillPercent / 100) * circumference;

    const color = yesPrice > 0.55 ? "#22c55e" : yesPrice < 0.45 ? "#ef4444" : "#a855f7";

    return (
      <svg
        width="44"
        height="24"
        viewBox="0 0 44 24"
        className="shrink-0"
        role="img"
        aria-label="Probability arc"
      >
        <title>Probability</title>
        <path
          d="M 4 22 A 18 18 0 0 1 40 22"
          fill="none"
          stroke="#27272a"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M 4 22 A 18 18 0 0 1 40 22"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
        <line
          x1="22"
          y1="22"
          x2="22"
          y2="8"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    );
  }

  const timeProgress =
    timeRemaining > 0 ? ((marketDuration - timeRemaining) / marketDuration) * 100 : 100;
  const progressColor =
    timeRemaining < 60 ? "bg-red-500" : timeRemaining < 180 ? "bg-amber-500" : "bg-emerald-500";

  // Odds strength: how far from 50%
  const probGap = Math.abs(yesPrice - 0.5) * 200; // 0–100%
  const probGapColor =
    probGap > 30 ? "text-green-400" : probGap > 15 ? "text-amber-400" : "text-zinc-400";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Timer + Odds */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              timeRemaining < 60
                ? "bg-red-500/20 animate-pulse"
                : timeRemaining < 180
                  ? "bg-amber-500/15"
                  : "bg-green-500/15"
            }`}
          >
            <Clock
              className={`h-4 w-4 ${
                timeRemaining < 60
                  ? "text-red-500"
                  : timeRemaining < 180
                    ? "text-amber-500"
                    : "text-green-500"
              }`}
            />
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">Hátralévő</span>
            <div
              className={`text-base font-extrabold font-mono ${timeRemaining < 60 ? "text-red-400 animate-pulse" : "text-zinc-100"}`}
            >
              {timeRemaining > 0 ? formatTime(timeRemaining) : "--:--"}
            </div>
          </div>

          {/* Odds */}
          <div className="flex items-center gap-2">
            <ProbabilityArc yesPrice={yesPrice} />
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase text-green-400">YES</span>
                <span className="text-xs font-extrabold font-mono text-green-400">
                  {(yesPrice * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase text-red-400">NO</span>
                <span className="text-xs font-extrabold font-mono text-red-400">
                  {(noPrice * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            {/* Prob gap indicator */}
            <div
              className={`text-[9px] font-mono font-bold ${probGapColor}`}
              title="Prob gap from 50%"
            >
              {probGap.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Target */}
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5">
            <span className="text-[9px] font-bold uppercase text-indigo-400">Target</span>
            <div className="text-base font-extrabold font-mono text-indigo-400">
              ${formatPrice(startPrice)}
            </div>
          </div>
        </div>

        {/* Current */}
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
            isUp && btcPrice > 0
              ? "bg-green-500/15 border-green-500/30"
              : "bg-red-500/15 border-red-500/30"
          }`}
        >
          <div>
            <span
              className={`text-[9px] font-bold uppercase ${isUp ? "text-green-400" : "text-red-400"}`}
            >
              Current
            </span>
            <div
              className={`text-base font-extrabold font-mono ${isUp ? "text-green-500" : "text-red-500"}`}
            >
              ${formatPrice(btcPrice)}
            </div>
          </div>
        </div>

        {/* Delta */}
        <div className={`flex items-center gap-2 ${isUp ? "text-green-500" : "text-red-500"}`}>
          {isUp ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          <span className="text-lg font-extrabold font-mono">{formatDelta(priceDelta)}</span>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-mono text-emerald-400">
            {volume > 0 ? `$${(volume / 1000).toFixed(1)}K` : "---"}
          </span>
        </div>

        {/* SSE Latency */}
        <div
          className="flex items-center gap-2"
          title={`JS processing: ${latency.current.toFixed(1)}ms`}
        >
          <Zap className="h-3.5 w-3.5 text-zinc-500" />
          <span className={`text-xs font-mono font-bold ${latencyColor}`}>
            {latency.current > 0.05 ? `${latency.current.toFixed(1)}ms` : "—"}
          </span>
        </div>

        {/* Right: Prediction */}
        <div
          className={`rounded-lg px-3 py-1.5 ${
            marketPrediction === "EXCEED"
              ? "bg-green-500/10 border border-green-500/20"
              : "bg-red-500/10 border border-red-500/20"
          }`}
        >
          <span
            className={`text-xs font-bold ${marketPrediction === "EXCEED" ? "text-green-500" : "text-red-500"}`}
          >
            {marketPrediction === "EXCEED" ? "BTC WILL EXCEED" : "BTC WILL STAY BELOW"}
          </span>
        </div>
      </div>

      {/* Time-to-resolution progress bar */}
      <div className="relative h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${progressColor} transition-all duration-1000 ease-linear`}
          style={{ width: `${timeProgress}%` }}
        />
      </div>
    </div>
  );
}

export function CommandCenter() {
  const [chartExpanded, setChartExpanded] = useState(false);
  const { hasCredentials, panels, togglePanel, emergencyStopActive, setEmergencyStop } =
    useAppStore();
  const { data: settings } = useSettings();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isConnected = isMounted && (hasCredentials || (settings?.has_credentials ?? false));
  const walletAddress = settings?.wallet_address;
  const bannerHidden = !isMounted;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Global Header */}
      <div className="flex flex-col gap-3">
        {!bannerHidden && !isConnected ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-sm text-amber-300 flex-1">
                Nincs csatlakoztatva —{" "}
                <Link
                  href="/settings"
                  className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                >
                  Beállítások
                </Link>
              </span>
              <span className="text-xs text-amber-400/60">vagy köss ügyletet</span>
            </div>
          </motion.div>
        ) : bannerHidden ? null : (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-emerald-300">
                Polymarket csatlakoztatva
                {walletAddress && walletAddress !== "***" && (
                  <span className="text-emerald-400/60 ml-2 font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                )}
              </span>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-4"
        >
          <div className="flex-1 min-w-0">
            <AccountInfoBar />
          </div>
          <ExportData />
          <button
            type="button"
            onClick={() => setEmergencyStop(!emergencyStopActive)}
            className={`flex flex-col items-center justify-center px-4 rounded-xl border transition-all shrink-0 ${
              emergencyStopActive
                ? "bg-red-500 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse"
                : "bg-zinc-900/50 text-red-500 border-red-500/30 hover:bg-red-500/10"
            }`}
          >
            <AlertTriangle className="h-6 w-6 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {emergencyStopActive ? "Állítva" : "Kill Switch"}
            </span>
          </button>
        </motion.div>
      </div>

      <QuickStart />

      {/* 2. Market Data */}
      <CollapsiblePanel
        title="Market Data"
        icon={<Target className="h-4 w-4" />}
        isOpen={panels.marketData}
        onToggle={() => togglePanel("marketData")}
      >
        <MarketBar />
      </CollapsiblePanel>

      {/* 3. Trading & Chart */}
      <CollapsiblePanel
        title="Trading & Chart"
        icon={<LineChart className="h-4 w-4" />}
        isOpen={panels.tradeAndChart}
        onToggle={() => togglePanel("tradeAndChart")}
        bodyClassName="p-0"
      >
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] p-4">
          <div className="min-w-0">
            <QuickTradePanel />
          </div>
          <div className="min-w-0">
            <ChartPanel
              expanded={chartExpanded}
              onToggle={() => setChartExpanded(!chartExpanded)}
            />
          </div>
        </div>
      </CollapsiblePanel>

      {/* 4. Active Operations */}
      <CollapsiblePanel
        title="Bot Fleet & Positions"
        icon={<BotIcon className="h-4 w-4" />}
        isOpen={panels.botsAndPositions}
        onToggle={() => togglePanel("botsAndPositions")}
        bodyClassName="p-0"
      >
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] p-4">
          <div className="min-w-0">
            <BotSelector />
          </div>
          <div className="min-w-0">
            <ActivityTabs />
          </div>
        </div>
      </CollapsiblePanel>

      {/* 5. Active Bets */}
      <CollapsiblePanel
        title="Active Bets"
        icon={<Target className="h-4 w-4" />}
        isOpen={true}
        onToggle={() => {}}
        bodyClassName="p-0"
      >
        <div className="p-4">
          <PendingBetMonitor />
        </div>
      </CollapsiblePanel>

      {/* 5.5 History */}
      <CollapsiblePanel
        title="Market History"
        icon={<History className="h-4 w-4" />}
        isOpen={panels.history}
        onToggle={() => togglePanel("history")}
        bodyClassName="p-0"
      >
        <div className="p-4">
          <MarketHistory />
          <div className="mt-4">
            <MarketTransitionAlert />
          </div>
        </div>
      </CollapsiblePanel>

      {/* 5.5 Cumulative P&L */}
      <CollapsiblePanel
        title="Cumulative P&L (Equity Curve)"
        icon={<TrendingUp className="h-4 w-4" />}
        isOpen={panels.equityCurve}
        onToggle={() => togglePanel("equityCurve")}
        bodyClassName="p-0"
      >
        <div className="p-4">
          <EquityCurve />
        </div>
      </CollapsiblePanel>

      {/* 6. Strategy Performance */}
      <CollapsiblePanel
        title="Strategy Performance"
        icon={<BarChart3 className="h-4 w-4" />}
        isOpen={panels.strategyPerformance}
        onToggle={() => togglePanel("strategyPerformance")}
        bodyClassName="p-0"
      >
        <StrategyPerformance />
      </CollapsiblePanel>

      {/* 6.5 Strategy Comparison Table */}
      <CollapsiblePanel
        title="Strategy Comparison"
        icon={<BarChart3 className="h-4 w-4" />}
        isOpen={true}
        onToggle={() => {}}
        bodyClassName="p-0"
      >
        <StrategyComparisonTable />
      </CollapsiblePanel>

      {/* 7. Trade Feed */}
      <CollapsiblePanel
        title="Trade Feed"
        icon={<Activity className="h-4 w-4" />}
        isOpen={panels.tradeFeed}
        onToggle={() => togglePanel("tradeFeed")}
        bodyClassName="p-0"
      >
        <TradeFeed />
      </CollapsiblePanel>

      {/* 7.5 Bot Thoughts */}
      <BotThoughts />

      {/* 8. System Health */}
      <CollapsiblePanel
        title="System Health"
        icon={<Shield className="h-4 w-4" />}
        isOpen={panels.systemHealth}
        onToggle={() => togglePanel("systemHealth")}
        bodyClassName="p-0"
      >
        <SystemHealth />
      </CollapsiblePanel>

      {/* 9. Backtest */}
      <CollapsiblePanel
        title="Backtest"
        icon={<History className="h-4 w-4" />}
        isOpen={true}
        onToggle={() => {}}
        bodyClassName="p-0"
      >
        <BacktestResults />
      </CollapsiblePanel>
    </div>
  );
}
