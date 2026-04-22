"use client";

import { motion } from "framer-motion";
import { Target, TrendingUp, Clock } from "lucide-react";
import { useAppStore } from "@/store";

export function BeatPriceIndicator() {
  const { btcPrice, beatPrice, timeRemaining } = useAppStore();

  const distance = beatPrice > 0 ? ((beatPrice - btcPrice) / btcPrice) * 100 : 0;
  const progress = Math.max(0, Math.min(100, 100 - Math.abs(distance) * 2));
  const isClose = Math.abs(distance) < 1;

  const formatPrice = (p: number) =>
    p > 0 ? `$${p.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "---";

  return (
    <div className="glass-card" style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Target size={20} style={{ color: "#22c55e" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "#fafafa" }}>Beat Price</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.25rem 0.75rem",
            borderRadius: 8,
            background: "rgba(20, 20, 28, 0.6)",
          }}
        >
          <Clock size={16} style={{ color: "#71717a" }} />
          <span className="price-ticker" style={{ fontSize: 14, color: "#a1a1aa" }}>
            {timeRemaining > 0 ? `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, "0")}` : "--:--"}
          </span>
        </div>
      </div>

      {/* Current BTC Price */}
      <div style={{ marginBottom: "1rem" }}>
        <span style={{ fontSize: 12, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          BTC Aktuális
        </span>
        <motion.div
          key={btcPrice}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.02, 1] }}
          className="price-ticker"
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: btcPrice > beatPrice ? "#22c55e" : "#fafafa",
          }}
        >
          {formatPrice(btcPrice)}
        </motion.div>
      </div>

      {/* Beat Price */}
      <div style={{ marginBottom: "1rem" }}>
        <span style={{ fontSize: 12, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Up Win Cél
        </span>
        <div className="price-ticker neon-green" style={{ fontSize: 24, fontWeight: 600 }}>
          {formatPrice(beatPrice)}
        </div>
      </div>

      {/* Distance */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <TrendingUp size={16} style={{ color: isClose ? "#22c55e" : "#71717a" }} />
        <span className="price-ticker" style={{ fontSize: 14, color: isClose ? "#22c55e" : "#a1a1aa" }}>
          {distance > 0 ? `${distance.toFixed(2)}% felett` : `${Math.abs(distance).toFixed(2)}% alatt`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="progress-bar">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`progress-fill ${isClose ? "progress-fill-green" : "progress-fill-blue"}`}
        />
      </div>

      {/* Status indicator */}
      <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <motion.div
          animate={isClose ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: isClose ? Infinity : 0, duration: 1 }}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 8,
            fontWeight: 500,
            fontSize: 14,
            background: isClose ? "rgba(34, 197, 94, 0.15)" : "rgba(20, 20, 28, 0.6)",
            color: isClose ? "#22c55e" : "#a1a1aa",
          }}
        >
          {isClose ? "🔥 Közel a célhoz!" : "Távolság a célhoz"}
        </motion.div>
      </div>
    </div>
  );
}