"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Trash2 } from "lucide-react";
import { useAppStore } from "@/store";

export function TerminalLog() {
  const { logs, clearLogs } = useAppStore();

  const getLevelColor = (level: string) => {
    switch (level) {
      case "success":
        return "#22c55e";
      case "error":
        return "#ef4444";
      case "warn":
        return "#f59e0b";
      default:
        return "#a1a1aa";
    }
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: "1rem",
        height: 200,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Terminal size={16} style={{ color: "#6366f1" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "#fafafa" }}>Terminal</span>
        </div>
        <button
          type="button"
          onClick={clearLogs}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "0.25rem 0.5rem",
            borderRadius: 4,
            fontSize: 12,
            color: "#71717a",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div
        className="terminal"
        style={{
          flex: 1,
          overflow: "auto",
          background: "rgba(0, 0, 0, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: 8,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.75rem",
          lineHeight: 1.4,
          padding: "0.5rem",
        }}
      >
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <div style={{ textAlign: "center", color: "#71717a", padding: "1rem" }}>
              <span style={{ fontSize: 12 }}>No activity...</span>
            </div>
          ) : (
            logs.slice(-20).map((log, idx) => (
              <motion.div
                key={`${log.timestamp}-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  padding: "0.25rem 0",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <span
                  className="price-ticker"
                  style={{ fontSize: 11, color: "#71717a", minWidth: 70 }}
                >
                  {formatTime(log.timestamp)}
                </span>
                <span
                  className="price-ticker"
                  style={{ fontSize: 11, color: getLevelColor(log.level), minWidth: 60 }}
                >
                  [{log.bot_name}]
                </span>
                <span style={{ fontSize: 11, color: "#fafafa" }}>
                  {log.message}
                </span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}