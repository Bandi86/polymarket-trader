"use client";

import { useAppStore } from "@/store";

export function TradingModeToggle() {
  const { tradingMode, setTradingMode } = useAppStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-900/90 p-1 backdrop-blur-md shadow-lg">
      <button
        type="button"
        onClick={() => setTradingMode("demo")}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
          tradingMode === "demo"
            ? "bg-indigo-500 text-white shadow"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <span>🎮</span>
        Demo
      </button>
      <button
        type="button"
        onClick={() => setTradingMode("live")}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
          tradingMode === "live"
            ? "bg-green-500 text-white shadow"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <span>⚡</span>
        Live
      </button>
    </div>
  );
}
