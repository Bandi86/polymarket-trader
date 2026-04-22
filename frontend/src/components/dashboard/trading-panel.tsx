"use client";

import { motion } from "framer-motion";
import { LineChart, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

type TradeSide = "UP" | "DOWN";

export function TradingPanel() {
  const [selectedSide, setSelectedSide] = useState<TradeSide | null>(null);

  return (
    <div className="glass-card" style={{ padding: "1.5rem", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <LineChart size={20} style={{ color: "#6366f1" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "#fafafa" }}>TradingView</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["1m", "5m", "15m", "1h"].map((tf) => (
            <button
              key={tf}
              type="button"
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                background: tf === "5m" ? "rgba(99, 102, 241, 0.15)" : "rgba(20, 20, 28, 0.6)",
                color: tf === "5m" ? "#6366f1" : "#a1a1aa",
                border: "none",
                cursor: "pointer",
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart placeholder */}
      <div
        style={{
          flex: 1,
          borderRadius: 12,
          background: "#0b0b0f",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <LineChart size={48} style={{ color: "#71717a", marginBottom: 8 }} />
          <span style={{ fontSize: 14, color: "#71717a" }}>
            TradingView chart integráció
          </span>
          <span style={{ fontSize: 12, color: "#71717a", display: "block", marginTop: 4 }}>
            BTC/USD 5m candlestick
          </span>
        </div>
      </div>

      {/* Trade buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedSide("UP")}
          className={`trade-btn trade-btn-up ${selectedSide === "UP" ? "trade-btn-up-active" : ""}`}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <TrendingUp size={20} />
            <span style={{ fontWeight: 700, fontSize: 18 }}>UP</span>
          </div>
          <span style={{ fontSize: 12, color: "rgba(34, 197, 94, 0.7)" }}>
            BTC felmozog 5 perc alatt
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedSide("DOWN")}
          className={`trade-btn trade-btn-down ${selectedSide === "DOWN" ? "trade-btn-down-active" : ""}`}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <TrendingDown size={20} />
            <span style={{ fontWeight: 700, fontSize: 18 }}>DOWN</span>
          </div>
          <span style={{ fontSize: 12, color: "rgba(239, 68, 68, 0.7)" }}>
            BTC lemozog 5 perc alatt
          </span>
        </motion.button>
      </div>
    </div>
  );
}