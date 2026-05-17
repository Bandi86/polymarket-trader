"use client";

import { motion } from "framer-motion";
import { Bot, Gauge, History, LineChart, Settings, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/store";

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  href?: string;
  onClick?: () => void;
  color?: "indigo" | "green" | "amber" | "red" | "violet" | "emerald";
  badge?: string | number;
  disabled?: boolean;
}

function QuickAction({
  icon,
  label,
  sublabel,
  href,
  onClick,
  color = "indigo",
  badge,
  disabled = false,
}: QuickActionProps) {
  const colorMap = {
    indigo: "border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-indigo-400",
    green:
      "border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5 text-emerald-400",
    amber: "border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5 text-amber-400",
    red: "border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 text-red-400",
    violet: "border-violet-500/20 hover:border-violet-500/40 hover:bg-violet-500/5 text-violet-400",
    emerald: "border-teal-500/20 hover:border-teal-500/40 hover:bg-teal-500/5 text-teal-400",
  };

  const content = (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-zinc-900/40 p-3 transition-all ${colorMap[color]} ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <div className="relative">
        <div className="flex h-8 w-8 items-center justify-center">{icon}</div>
        {badge !== undefined && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] font-semibold">{label}</span>
        {sublabel && <span className="text-[9px] text-zinc-600">{sublabel}</span>}
      </div>
    </motion.button>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

interface QuickActionsToolbarProps {
  showLabels?: boolean;
  compact?: boolean;
}

export function QuickActionsToolbar({
  showLabels: _showLabels = true,
  compact: _compact = false,
}: QuickActionsToolbarProps) {
  const { tradingMode, sseHealth, latency } = useAppStore();
  const isDemo = tradingMode === "demo";

  const latencyAvg = latency.avg;
  const latencyStatus =
    latencyAvg > 0 && latencyAvg < 200
      ? "green"
      : latencyAvg > 0 && latencyAvg < 500
        ? "amber"
        : "red";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="flex items-center gap-2"
    >
      <div
        className={`flex items-center gap-1 rounded-xl border px-3 py-2 ${
          isDemo ? "border-indigo-500/20 bg-indigo-500/5" : "border-emerald-500/20 bg-emerald-500/5"
        }`}
      >
        {/* Mode indicator */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-white/10">
          <span
            className={`text-[9px] font-bold uppercase ${isDemo ? "text-indigo-400" : "text-emerald-400"}`}
          >
            {isDemo ? "Demo" : "Live"}
          </span>
        </div>

        {/* Latency */}
        {latencyAvg > 0 && (
          <div
            className={`flex items-center gap-1 px-2 border-r border-white/10 text-${latencyStatus}-400`}
          >
            <Gauge className={`h-3 w-3`} />
            <span className={`text-[10px] font-mono font-semibold text-${latencyStatus}-400`}>
              {latencyAvg}ms
            </span>
          </div>
        )}

        {/* Quick nav links */}
        <div className="flex items-center gap-1 pl-2">
          <QuickAction
            icon={<Bot className="h-4 w-4" />}
            label="Bots"
            href="/bots"
            color="indigo"
          />
          <QuickAction
            icon={<LineChart className="h-4 w-4" />}
            label="Markets"
            href="/markets"
            color="green"
          />
          <QuickAction
            icon={<History className="h-4 w-4" />}
            label="Orders"
            href="/orders"
            color="amber"
          />
          <QuickAction
            icon={<TrendingUp className="h-4 w-4" />}
            label="Funding"
            href="/funding"
            color="violet"
          />
          <QuickAction
            icon={<Settings className="h-4 w-4" />}
            label="Settings"
            href="/settings"
            color="emerald"
          />
        </div>
      </div>

      {/* Quick status */}
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <div
          className={`h-1.5 w-1.5 rounded-full ${sseHealth.connected ? "bg-emerald-400" : "bg-red-400"}`}
        />
        <span>{sseHealth.connected ? "Connected" : "Disconnected"}</span>
      </div>
    </motion.div>
  );
}
