// BotStatusBadge - Shows ACTIVE/PASSIVE/PAUSED/ERROR/STOPPED status

import React from "react";

type BotStatus = "ACTIVE" | "PASSIVE" | "PAUSED" | "ERROR" | "STOPPED";

interface BotStatusBadgeProps {
  status: BotStatus;
  lastActionTime?: number;
}

const statusStyles: Record<BotStatus, { bg: string; color: string; icon: string }> = {
  ACTIVE: { bg: "rgba(34, 197, 94, 0.2)", color: "#22c55e", icon: "●" },
  PASSIVE: { bg: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", icon: "○" },
  PAUSED: { bg: "rgba(239, 68, 68, 0.2)", color: "#ef4444", icon: "⏸" },
  ERROR: { bg: "rgba(239, 68, 68, 0.3)", color: "#ef4444", icon: "⚠" },
  STOPPED: { bg: "rgba(107, 114, 128, 0.2)", color: "#6b7280", icon: "○" },
};

export function BotStatusBadge({ status, lastActionTime }: BotStatusBadgeProps) {
  const style = statusStyles[status];
  const timeAgo = lastActionTime ? formatTimeAgo(lastActionTime) : null;

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "0.25rem",
      padding: "0.15rem 0.5rem",
      borderRadius: 4,
      background: style.bg,
      color: style.color,
      fontWeight: 600,
      fontSize: "0.7rem",
    }}>
      <span>{style.icon}</span>
      <span>{status}</span>
      {timeAgo && <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>{timeAgo}</span>}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export default BotStatusBadge;