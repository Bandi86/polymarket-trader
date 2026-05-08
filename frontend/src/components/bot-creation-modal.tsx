"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Bot as BotIcon, ChevronDown, Loader2, X, Zap } from "lucide-react";
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
    label: "🟢 BTC Momentum",
    strategy: "momentum",
    bet_size: 10,
    description: "BTC árfolyam emelkedését követi",
  },
  {
    label: "🔵 Mean Reversion",
    strategy: "mean_reversion",
    bet_size: 8,
    description: "Árfolyam visszatérést vár extreme elmozdulás után",
  },
  {
    label: "⚡ T-10 Sniper",
    strategy: "last_seconds_scalp",
    bet_size: 5,
    description: "Utolsó 10 másodpercben lép be",
  },
  {
    label: "📊 Volatility Breakout",
    strategy: "volatility_breakout",
    bet_size: 12,
    description: "Extrém volatilitásnál kereskedik",
  },
];

const STRATEGIES = Object.entries(STRATEGY_LABELS) as [
  StrategyType,
  (typeof STRATEGY_LABELS)[StrategyType],
][];

export function CreateBotModal({ onClose, onSuccess, prefill }: CreateBotModalProps) {
  const [step, setStep] = useState<"template" | "customize">("template");
  const [_selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<StrategyType>("momentum");
  const [betSize, setBetSize] = useState(10);
  const [stopLoss, setStopLoss] = useState(0.2);
  const [takeProfit, setTakeProfit] = useToProfit(0.3);

  // Apply prefill from Strategy Lab
  useEffect(() => {
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
    if (prefill?.strategy || prefill?.name) setStep("customize");
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
        name: name.trim(),
        strategy,
        bet_size: betSize,
        stop_loss: stopLoss,
        take_profit: takeProfit,
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
          <div className="p-5">
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
                  <p className="mt-1 text-xs text-zinc-500">
                    {STRATEGY_LABELS[strategy]?.description}
                  </p>
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

                {/* Strategy badge */}
                <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-500">Stratégia</p>
                      <p className="text-sm font-semibold text-indigo-400">
                        {STRATEGY_LABELS[strategy]?.name ?? strategy}
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
