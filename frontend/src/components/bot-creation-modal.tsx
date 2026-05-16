"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Bot as BotIcon,
  ChevronDown,
  Gauge,
  Info,
  Loader2,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/glass-card";
import { useCreateBot } from "@/hooks";
import { STRATEGY_LABELS, type StrategyType } from "@/types";

interface CreateBotModalProps {
  onClose: () => void;
  onSuccess?: (botId: number) => void;
  prefill?: {
    strategy?: StrategyType;
    marketId?: string;
    marketName?: string;
    name?: string;
  };
}

const TEMPLATES: {
  label: string;
  strategy: StrategyType;
  bet_size: number;
  description: string;
}[] = [
  {
    label: "\uD83D\uDFE2 BTC Momentum",
    strategy: "momentum",
    bet_size: 1,
    description: "BTC \u00E1rfolyam emelked\u00E9s\u00E9t k\u00F6veti",
  },
  {
    label: "\uD83D\uDD35 Mean Reversion",
    strategy: "mean_reversion",
    bet_size: 1,
    description: "\u00C1rfolyam visszat\u00E9r\u00E9st v\u00E1r extreme elmozdul\u00E1s ut\u00E1n",
  },
  {
    label: "\u26A1 T-10 Sniper",
    strategy: "last_seconds_scalp",
    bet_size: 1,
    description: "Utols\u00F3 10 m\u00E1sodpercben l\u00E9p be",
  },
  {
    label: "\uD83D\uDCCA Volatility Breakout",
    strategy: "volatility_breakout",
    bet_size: 1,
    description: "Extr\u00E9m volatilit\u00E1sn\u00E1l kereskedik",
  },
];

const STRATEGIES = Object.entries(STRATEGY_LABELS) as [
  StrategyType,
  (typeof STRATEGY_LABELS)[StrategyType],
][];

const STRATEGY_CATEGORY_HINTS: Record<string, string> = {
  Momentum: "Best for trending markets with clear BTC direction",
  "Mean Rev": "Best for range-bound markets with extreme prices",
  Arbitrage: "Best for capturing market inefficiencies",
  Trend: "Best for following established price trends",
};

const RISK_COLORS = [
  "bg-emerald-500",
  "bg-emerald-500",
  "bg-yellow-500",
  "bg-yellow-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-red-500",
  "bg-red-600",
];

function getCategoryColor(category: string): string {
  switch (category) {
    case "Momentum":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "Mean Rev":
      return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    case "Arbitrage":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Trend":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  }
}

function getCategoryBestFor(category: string): string {
  return STRATEGY_CATEGORY_HINTS[category] ?? "Configure parameters to match your market view";
}

export function CreateBotModal({ onClose, onSuccess, prefill }: CreateBotModalProps) {
  const [step, setStep] = useState<"template" | "customize">("template");
  const [_selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<StrategyType>("momentum");
  const [betSize, setBetSize] = useState(10);
  const [stopLoss, setStopLoss] = useState(0.2);
  const [takeProfit, setTakeProfit] = useToProfit(0.3);
  const [marketId, setMarketId] = useState(prefill?.marketId || "");
  const [marketName, setMarketName] = useState(prefill?.marketName || "");

  const [kellyFraction, setKellyFraction] = useState(0.5);
  const [maxBetPercent, setMaxBetPercent] = useState(25);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [strategyParams, setStrategyParams] = useState({
    min_delta: 0.05,
    max_delta: 3.0,
    min_price: 0.10,
    max_price: 0.80,
  });

  const conservativePct = ((0.25 * kellyFraction) * maxBetPercent).toFixed(1);
  const moderatePct = ((0.50 * kellyFraction) * maxBetPercent).toFixed(1);
  const aggressivePct = ((0.75 * kellyFraction) * maxBetPercent).toFixed(1);

  const riskLevel = Math.round(kellyFraction * (RISK_COLORS.length - 1));
  const riskColor = RISK_COLORS[riskLevel];
  const riskLabels = ["Very Low", "Low", "Moderate", "Moderate", "High", "Very High", "Extreme", "Max"];
  const riskLabel = riskLabels[riskLevel];

  // Apply prefill from Strategy Lab or Markets page
  useEffect(() => {
    if (prefill?.marketName) {
      setMarketName(prefill.marketName);
      setName(`Bot - ${prefill.marketName.slice(0, 30)}`);
    }
    if (prefill?.marketId) setMarketId(prefill.marketId);
    if (prefill?.strategy) {
      const matchedTemplate = TEMPLATES.findIndex((t) => t.strategy === prefill.strategy);
      if (matchedTemplate >= 0) {
        const t = TEMPLATES[matchedTemplate];
        setSelectedTemplate(matchedTemplate);
        setStrategy(t.strategy);
        setBetSize(t.bet_size);
      } else {
        setStrategy(prefill.strategy);
      }
    }
    if (prefill?.name) setName(prefill.name);
    if (prefill?.strategy || prefill?.name || prefill?.marketId) setStep("customize");
  }, [prefill]);

  const createBot = useCreateBot();
  const isLoading = createBot.isPending;

  const handleTemplateSelect = (idx: number) => {
    const t = TEMPLATES[idx];
    setSelectedTemplate(idx);
    setStrategy(t.strategy);
    setBetSize(t.bet_size);
    setStep("customize");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Adj nevet a botnak!");
      return;
    }
    if (betSize <= 0) {
      toast.error("A tét nagyobb kell legyen mint 0!");
      return;
    }

    createBot.mutate(
      {
        name: name.trim() || generatedName,
        strategy,
        strategy_type: strategy,
        bet_size: betSize,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        kelly_fraction: kellyFraction,
        max_bet: maxBetPercent / 100,
        params: JSON.stringify(strategyParams),
        trading_mode: "demo",
        market_id: marketId || undefined,
      },
      {
        onSuccess: (bot) => {
          toast.success(`Bot létrehozva: ${name}`);
          onSuccess?.(bot.id);
          onClose();
        },
        onError: (err) => {
          toast.error(err.message || "Hiba a bot létrehozásakor");
        },
      }
    );
  };

  const generatedName = name.trim() || `${STRATEGY_LABELS[strategy]?.name ?? strategy} Bot`;

  const strategyInfo = STRATEGY_LABELS[strategy];
  const categoryHint = strategyInfo ? getCategoryBestFor(strategyInfo.category) : "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg"
      >
        <GlassCard className="p-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15">
                <BotIcon className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-100">Új Bot Létrehozása</h2>
                <p className="text-xs text-zinc-500">
                  {step === "template"
                    ? "Válassz sablont vagy stratégiát"
                    : "Állítsd be a paramétereket"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 max-h-[70vh] overflow-y-auto">
            {step === "template" && (
              <div className="space-y-3">
                {/* Template grid */}
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t, idx) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => handleTemplateSelect(idx)}
                      className="text-left p-3 rounded-xl border border-white/8 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 transition-all"
                    >
                      <span className="text-sm font-semibold text-zinc-200 block mb-0.5">
                        {t.label}
                      </span>
                      <span className="text-xs text-zinc-500">{t.description}</span>
                    </button>
                  ))}
                </div>

                <div className="relative flex items-center gap-3 py-2">
                  <div className="flex-1 border-t border-white/10" />
                  <span className="text-xs text-zinc-600">vagy</span>
                  <div className="flex-1 border-t border-white/10" />
                </div>

                {/* Strategy picker */}
                <div>
                  <label
                    htmlFor="strategy-select"
                    className="text-xs font-medium text-zinc-400 mb-1.5 block"
                  >
                    Stratégia választás
                  </label>
                  <div className="relative">
                    <select
                      id="strategy-select"
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value as StrategyType)}
                      className="w-full appearance-none rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-2.5 pr-8 text-sm text-zinc-200 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20"
                    >
                      {STRATEGIES.map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep("customize")}
                  className="w-full py-2.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/25 transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Tovább a testreszabáshoz
                </button>
              </div>
            )}

            {step === "customize" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label
                    htmlFor="bot-name-input"
                    className="text-xs font-medium text-zinc-400 mb-1.5 block"
                  >
                    Bot neve
                  </label>
                  <input
                    type="text"
                    id="bot-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={generatedName}
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Market info */}
                {marketName && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500">Kiválasztott piac</p>
                        <p className="text-sm font-semibold text-emerald-400 truncate">
                          {marketName}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Strategy badge + Info Panel */}
                <div className="rounded-lg border border-white/10 bg-zinc-800/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs text-zinc-500">Stratégia</p>
                      <p className="text-sm font-semibold text-zinc-200">
                        {strategyInfo?.name ?? strategy}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep("template")}
                      className="text-xs text-indigo-400/60 hover:text-indigo-400 underline"
                    >
                      Módosít
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getCategoryColor(strategyInfo?.category ?? "")}`}
                    >
                      {strategyInfo?.category ?? "N/A"}
                    </span>
                    {strategyInfo?.description && (
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <Info className="h-3 w-3 shrink-0" />
                        <span>{strategyInfo.description}</span>
                      </div>
                    )}
                  </div>

                  {/* Best for hint */}
                  <p className="mt-2 text-xs text-zinc-600 italic">
                    {categoryHint}
                  </p>
                </div>

                {/* Bet size */}
                <div>
                  <label
                    htmlFor="bet-size-range"
                    className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center justify-between"
                  >
                    <span>Tét ($)</span>
                    <span className="text-indigo-400 font-bold">${betSize}</span>
                  </label>
                  <input
                    id="bet-size-range"
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={betSize}
                    onChange={(e) => setBetSize(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-xs text-zinc-600 mt-1">
                    <span>$1</span>
                    <span>$100</span>
                  </div>
                </div>

                {/* Stop loss / Take profit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="stop-loss-input"
                      className="text-xs font-medium text-zinc-400 mb-1.5 block"
                    >
                      Stop Loss (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="stop-loss-input"
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={stopLoss}
                        onChange={(e) => setStopLoss(Number(e.target.value))}
                        className="w-full rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-red-500/40"
                      />
                      <span className="text-sm text-zinc-500">%</span>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="take-profit-input"
                      className="text-xs font-medium text-zinc-400 mb-1.5 block"
                    >
                      Take Profit (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="take-profit-input"
                        type="number"
                        min={0}
                        max={2}
                        step={0.05}
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(Number(e.target.value))}
                        className="w-full rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-green-500/40"
                      />
                      <span className="text-sm text-zinc-500">%</span>
                    </div>
                  </div>
                </div>

                {/* Kelly Calculator Visualizer */}
                <div className="rounded-lg border border-white/10 bg-zinc-800/40 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      Kelly Calculator
                    </span>
                  </div>

                  {/* Kelly Fraction slider */}
                  <div>
                    <label
                      htmlFor="kelly-fraction-range"
                      className="text-xs text-zinc-400 mb-1.5 flex items-center justify-between"
                    >
                      <span>Kelly Fraction</span>
                      <span className="font-bold text-indigo-400">{kellyFraction.toFixed(2)}</span>
                    </label>
                    <input
                      id="kelly-fraction-range"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={kellyFraction}
                      onChange={(e) => setKellyFraction(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {/* Max Bet slider */}
                  <div>
                    <label
                      htmlFor="max-bet-range"
                      className="text-xs text-zinc-400 mb-1.5 flex items-center justify-between"
                    >
                      <span>Max Bet (% of bankroll)</span>
                      <span className="font-bold text-indigo-400">{maxBetPercent}%</span>
                    </label>
                    <input
                      id="max-bet-range"
                      type="range"
                      min={5}
                      max={50}
                      step={5}
                      value={maxBetPercent}
                      onChange={(e) => setMaxBetPercent(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {/* Live Kelly values */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-center">
                      <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                        Conservative
                      </p>
                      <p className="text-sm font-bold text-emerald-300">
                        {conservativePct}%
                      </p>
                      <p className="text-[10px] text-zinc-600">0.25 fraction</p>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-center">
                      <p className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">
                        Moderate
                      </p>
                      <p className="text-sm font-bold text-amber-300">
                        {moderatePct}%
                      </p>
                      <p className="text-[10px] text-zinc-600">0.50 fraction</p>
                    </div>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-center">
                      <p className="text-[10px] text-red-400 font-medium uppercase tracking-wider">
                        Aggressive
                      </p>
                      <p className="text-sm font-bold text-red-300">
                        {aggressivePct}%
                      </p>
                      <p className="text-[10px] text-zinc-600">0.75 fraction</p>
                    </div>
                  </div>

                  {/* Risk meter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Risk Level</span>
                      <span className="text-[10px] font-semibold text-zinc-400">{riskLabel}</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-700 overflow-hidden flex">
                      {RISK_COLORS.map((color, i) => (
                        <div
                          key={i}
                          className={`flex-1 transition-all duration-300 ${
                            i <= riskLevel ? color : "bg-zinc-700"
                          } ${i > 0 ? "ml-0.5" : ""}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-600">
                      <span>Conservative</span>
                      <span>Aggressive</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-white/10 bg-zinc-800/40 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
                </button>

                {/* Strategy Parameter Editor (Advanced) */}
                {showAdvanced && (
                  <div className="rounded-lg border border-white/10 bg-zinc-800/40 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                        Strategy Parameters
                      </span>
                    </div>

                    <div>
                      <label
                        htmlFor="min-delta-range"
                        className="text-xs text-zinc-400 mb-1.5 flex items-center justify-between"
                      >
                        <span>Min Delta</span>
                        <span className="font-bold text-zinc-300">{strategyParams.min_delta.toFixed(2)}</span>
                      </label>
                      <input
                        id="min-delta-range"
                        type="range"
                        min={0.01}
                        max={1.0}
                        step={0.01}
                        value={strategyParams.min_delta}
                        onChange={(e) =>
                          setStrategyParams({ ...strategyParams, min_delta: Number(e.target.value) })
                        }
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-xs text-zinc-600 mt-1">
                        <span>0.01</span>
                        <span>1.00</span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="max-delta-range"
                        className="text-xs text-zinc-400 mb-1.5 flex items-center justify-between"
                      >
                        <span>Max Delta</span>
                        <span className="font-bold text-zinc-300">{strategyParams.max_delta.toFixed(1)}</span>
                      </label>
                      <input
                        id="max-delta-range"
                        type="range"
                        min={1.0}
                        max={10.0}
                        step={0.5}
                        value={strategyParams.max_delta}
                        onChange={(e) =>
                          setStrategyParams({ ...strategyParams, max_delta: Number(e.target.value) })
                        }
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-xs text-zinc-600 mt-1">
                        <span>1.0</span>
                        <span>10.0</span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="min-price-range"
                        className="text-xs text-zinc-400 mb-1.5 flex items-center justify-between"
                      >
                        <span>Min Price</span>
                        <span className="font-bold text-zinc-300">{strategyParams.min_price.toFixed(2)}</span>
                      </label>
                      <input
                        id="min-price-range"
                        type="range"
                        min={0.05}
                        max={0.50}
                        step={0.05}
                        value={strategyParams.min_price}
                        onChange={(e) =>
                          setStrategyParams({ ...strategyParams, min_price: Number(e.target.value) })
                        }
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-xs text-zinc-600 mt-1">
                        <span>0.05</span>
                        <span>0.50</span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="max-price-range"
                        className="text-xs text-zinc-400 mb-1.5 flex items-center justify-between"
                      >
                        <span>Max Price</span>
                        <span className="font-bold text-zinc-300">{strategyParams.max_price.toFixed(2)}</span>
                      </label>
                      <input
                        id="max-price-range"
                        type="range"
                        min={0.50}
                        max={0.95}
                        step={0.05}
                        value={strategyParams.max_price}
                        onChange={(e) =>
                          setStrategyParams({ ...strategyParams, max_price: Number(e.target.value) })
                        }
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-xs text-zinc-600 mt-1">
                        <span>0.50</span>
                        <span>0.95</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning */}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-300">
                      Demo módban a botok szimulált egyenleget használnak. Live módban valódi USDC-t
                      kockáztatsz!
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep("template")}
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Vissza
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BotIcon className="h-4 w-4" />
                    )}
                    {isLoading ? "Létrehozás..." : "Bot létrehozása"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

// Custom hook for take profit to avoid recalc issues
function useToProfit(defaultVal: number) {
  const [val, setVal] = useState(defaultVal);
  const setter = (v: number) => {
    if (v >= 0) setVal(v);
  };
  return [val, setter] as const;
}
