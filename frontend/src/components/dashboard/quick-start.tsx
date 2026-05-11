"use client";

import { motion } from "framer-motion";
import { Bot, Play, Settings, Target } from "lucide-react";
import Link from "next/link";
import { useBots } from "@/hooks";

export function QuickStart() {
  const { data: bots, isLoading } = useBots();

  if (isLoading || (bots && bots.length > 0)) {
    return null; // Do not show if loading or if user already has bots
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-6 mb-4"
    >
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-indigo-400 mb-2 flex items-center gap-2">
            <Target className="h-6 w-6" />
            Üdvözlünk a CommandCenter-ben!
          </h2>
          <p className="text-zinc-400 text-sm mb-4">
            A rendszer jelenleg üres. Hozz létre egy új kereskedő botot, hogy elkezdhesd a
            Polymarket kereskedést. Demo módban kockázat nélkül tesztelheted a stratégiákat
            virtuális egyenleggel.
          </p>
          <div className="flex gap-3">
            <Link
              href="/bots"
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Bot className="h-4 w-4" />
              Új Bot Létrehozása
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10"
            >
              <Settings className="h-4 w-4" />
              Beállítások
            </Link>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center justify-center p-4 bg-black/20 rounded-xl border border-white/5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Play className="h-8 w-8 text-emerald-400" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Készen áll az indulásra
          </span>
        </div>
      </div>
    </motion.div>
  );
}
