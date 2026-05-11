// BotDeltaInfo - Shows BTC delta %, signal direction, BTC price

import React from "react";

interface BotDeltaInfoProps {
  btcDelta?: number; // Percentage (e.g., 0.08 = 0.08%)
  btcPrice?: number;
  windowOpen?: number;
  signalType?: "UP" | "DOWN" | "NEUTRAL" | null;
}

export function BotDeltaInfo({ btcDelta, btcPrice, signalType }: BotDeltaInfoProps) {
  const delta = btcDelta ?? 0;
  const isUp = delta > 0;
  const isStrong = Math.abs(delta) > 0.08;

  const deltaColor = isUp ? "#22c55e" : "#ef4444";
  const signalIcon = signalType === "UP" ? "↑" : signalType === "DOWN" ? "↓" : "○";
  const signalColor = signalType === "UP" ? "#22c55e" : signalType === "DOWN" ? "#ef4444" : "#888";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.375rem 0.5rem",
        borderRadius: 6,
        background: isStrong
          ? isUp
            ? "rgba(34, 197, 94, 0.1)"
            : "rgba(239, 68, 68, 0.1)"
          : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <span style={{ color: "#888", fontSize: "0.65rem" }}>Δ BTC:</span>
        <span
          style={{
            color: deltaColor,
            fontWeight: 600,
            fontSize: "0.75rem",
          }}
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(3)}%
        </span>
      </div>

      {signalType && signalType !== "NEUTRAL" && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ color: signalColor, fontSize: "0.75rem" }}>{signalIcon}</span>
          <span style={{ color: signalColor, fontSize: "0.65rem" }}>
            {signalType === "UP" ? "UP signal" : "DOWN signal"}
          </span>
        </div>
      )}

      {btcPrice && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ color: "#888", fontSize: "0.65rem" }}>BTC:</span>
          <span style={{ color: "#aaa", fontSize: "0.75rem" }}>${formatPrice(btcPrice)}</span>
        </div>
      )}
    </div>
  );
}

function formatPrice(price: number): string {
  return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default BotDeltaInfo;
