"use client";

import { motion } from "framer-motion";
import { Activity, Play, Pause } from "lucide-react";
import { useAppStore } from "@/store";
import type { BotStatus } from "@/types";

export function BotStatusGrid() {
  const { bots, selectedBotId, setSelectedBot } = useAppStore();

  const getStatusStyle = (status: BotStatus) => {
    switch (status) {
      case "running":
        return {
          background: "rgba(34, 197, 94, 0.15)",
          color: "#22c55e",
          borderColor: "rgba(34, 197, 94, 0.3)",
        };
      case "error":
        return {
          background: "rgba(239, 68, 68, 0.15)",
          color: "#ef4444",
          borderColor: "rgba(239, 68, 68, 0.3)",
        };
      default:
        return {
          background: "rgba(20, 20, 28, 0.6)",
          color: "#71717a",
          borderColor: "rgba(255, 255, 255, 0.08)",
        };
    }
  };

  const runningCount = bots.filter((b) => b.status === "running").length;

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Activity size={16} style={{ color: "#6366f1" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "#fafafa" }}>Botok Állapota</span>
        </div>
        <span style={{ fontSize: 12, color: "#71717a" }}>
          {runningCount} / {bots.length} fut
        </span>
      </div>

      {/* Bot grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {bots.length === 0 ? (
          <div style={{ gridColumn: "span 4", textAlign: "center", padding: "1rem", color: "#71717a" }}>
            <span style={{ fontSize: 12 }}>Nincs bot</span>
          </div>
        ) : (
          bots.map((bot) => {
            const style = getStatusStyle(bot.status);
            const isSelected = bot.id === selectedBotId;

            return (
              <motion.button
                key={bot.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedBot(bot.id)}
                style={{
                  padding: "0.5rem",
                  borderRadius: 8,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  background: style.background,
                  border: `1px solid ${style.borderColor}`,
                  color: style.color,
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 0 0 2px #6366f1" : "none",
                }}
              >
                <div className={`status-dot status-dot-${bot.status}`} />
                <span style={{ fontSize: 12, fontWeight: 500, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {bot.name.slice(0, 8)}
                </span>
              </motion.button>
            );
          })
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, marginTop: "0.75rem" }}>
        <button type="button" className="btn-green" style={{ flex: 1 }}>
          <Play size={16} />
          <span style={{ fontSize: 12 }}>Indít</span>
        </button>
        <button type="button" className="btn-red" style={{ flex: 1 }}>
          <Pause size={16} />
          <span style={{ fontSize: 12 }}>Leállít</span>
        </button>
      </div>
    </div>
  );
}