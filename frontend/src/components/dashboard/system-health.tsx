"use client";

import { motion } from "framer-motion";
import { AlertCircle, Bot, Globe, Server, Wifi } from "lucide-react";
import { useAppStore } from "@/store";

interface HealthIndicatorProps {
  label: string;
  status: "healthy" | "degraded" | "unhealthy" | "connecting" | "unknown";
  icon: React.ReactNode;
  detail?: string;
  latency?: number;
  subLabel?: string;
}

function HealthIndicator({
  label,
  status,
  icon,
  detail: _detail,
  latency,
  subLabel,
}: HealthIndicatorProps) {
  const statusConfig = {
    healthy: {
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30",
      dot: "bg-emerald-400",
      label: "Online",
    },
    degraded: {
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      dot: "bg-amber-400",
      label: "Degraded",
    },
    unhealthy: {
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/30",
      dot: "bg-red-400",
      label: "Offline",
    },
    connecting: {
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/30",
      dot: "bg-blue-400 animate-pulse",
      label: "Connecting",
    },
    unknown: {
      color: "text-zinc-400",
      bg: "bg-zinc-500/10 border-zinc-500/30",
      dot: "bg-zinc-400",
      label: "Unknown",
    },
  };

  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center justify-between rounded-lg border ${config.bg} px-3 py-2`}
    >
      <div className="flex items-center gap-2">
        <div className={config.color}>{icon}</div>
        <span className="text-xs font-medium text-zinc-300">{label}</span>
        {subLabel && <span className="text-[10px] font-mono text-zinc-500">({subLabel})</span>}
      </div>
      <div className="flex items-center gap-2">
        {latency !== undefined && latency > 0 && (
          <span className="text-[10px] font-mono text-zinc-500">{latency}ms</span>
        )}
        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          <span className={`text-[10px] font-medium ${config.color}`}>{config.label}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function SystemHealth() {
  const { sseHealth, latency, systemStatus, apiLatency } = useAppStore();

  const uptime =
    sseHealth.connected && sseHealth.connectedSince
      ? Math.floor((Date.now() - sseHealth.connectedSince) / 1000)
      : 0;

  const formatUptime = (seconds: number) => {
    if (seconds === 0) return "--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Determine overall health
  const overallStatus = sseHealth.status;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-zinc-200">System Health</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              overallStatus === "healthy"
                ? "bg-emerald-400"
                : overallStatus === "degraded"
                  ? "bg-amber-400"
                  : overallStatus === "unhealthy"
                    ? "bg-red-400"
                    : "bg-blue-400 animate-pulse"
            }`}
          />
          <span className="text-[10px] font-medium text-zinc-500 uppercase">{overallStatus}</span>
        </div>
      </div>

      {/* Health Indicators Grid */}
      <div className="grid grid-cols-2 gap-2">
        <HealthIndicator
          label="SSE"
          status={sseHealth.connected ? "healthy" : sseHealth.status}
          icon={<Wifi className="h-3.5 w-3.5" />}
          latency={latency.current > 0 ? latency.current : undefined}
        />
        <HealthIndicator
          label="API"
          status={
            apiLatency > 0 && apiLatency < 500 ? "healthy" : apiLatency > 0 ? "degraded" : "unknown"
          }
          icon={<Globe className="h-3.5 w-3.5" />}
          latency={apiLatency > 0 ? apiLatency : undefined}
        />
        <HealthIndicator
          label="Bots"
          status={
            systemStatus && systemStatus.bots_running > 0
              ? "healthy"
              : systemStatus
                ? "degraded"
                : "unknown"
          }
          icon={<Bot className="h-3.5 w-3.5" />}
          subLabel={`${systemStatus?.bots_running ?? 0}/${systemStatus?.bots_total ?? 0}`}
        />
        <HealthIndicator
          label="Backend"
          status={apiLatency > 0 ? "healthy" : "unknown"}
          icon={<Server className="h-3.5 w-3.5" />}
          latency={apiLatency > 0 ? apiLatency : undefined}
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-lg bg-zinc-900/60 px-2 py-1.5">
          <span className="text-[10px] text-zinc-500">Uptime</span>
          <span className="text-xs font-mono font-semibold text-zinc-300">
            {formatUptime(uptime)}
          </span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-zinc-900/60 px-2 py-1.5">
          <span className="text-[10px] text-zinc-500">Messages</span>
          <span className="text-xs font-mono font-semibold text-zinc-300">
            {sseHealth.messageCount}
          </span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-zinc-900/60 px-2 py-1.5">
          <span className="text-[10px] text-zinc-500">Reconnects</span>
          <span className="text-xs font-mono font-semibold text-zinc-300">
            {sseHealth.reconnectCount}
          </span>
        </div>
      </div>

      {/* Latency Sparkline (simplified bar chart) */}
      {latency.samples.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-500">Latency</span>
            <span className="font-mono text-zinc-400">
              avg: {latency.avg}ms / min: {latency.min}ms / max: {latency.max}ms
            </span>
          </div>
          <div className="flex h-6 items-end gap-[2px]">
            {latency.samples.slice(-20).map((sample, i) => {
              const height = Math.min((sample / (latency.max || 100)) * 24, 24);
              const color =
                sample > 500
                  ? "bg-red-500/60"
                  : sample > 200
                    ? "bg-amber-500/60"
                    : "bg-emerald-500/60";
              const uniqueId = `latency-${sample}-${i}`;
              return (
                <div
                  key={uniqueId}
                  className={`flex-1 rounded-sm ${color} transition-all`}
                  style={{ height: `${Math.max(height, 2)}px` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Error indicator */}
      {sseHealth.errorCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-[10px] text-red-400">
            {sseHealth.errorCount} error{sseHealth.errorCount > 1 ? "s" : ""} detected
          </span>
        </div>
      )}
    </motion.div>
  );
}
