"use client";

import { motion } from "framer-motion";
import { LineChart, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/store";
import { useQuickTrade } from "@/hooks/use-api";
import { toast } from "sonner";
import { TradingViewWidget } from "@/components/ui/trading-view-widget";

type TradeSide = "UP" | "DOWN";

export function TradingPanel() {
  const [selectedSide, setSelectedSide] = useState<TradeSide | null>(null);
  const [amount, setAmount] = useState(10);
  const { btcPrice, beatPrice, addLog } = useAppStore();
  const quickTrade = useQuickTrade();

  const handleTrade = async (side: TradeSide) => {
    if (amount <= 0 || amount > 1000) {
      toast.error("Invalid amount", { description: "Amount must be between 1-1000 USDC" });
      return;
    }

    setSelectedSide(side);

    addLog({
      bot_id: 0,
      bot_name: "Manual Trade",
      message: `Placing ${side} bet for ${amount} USDC...`,
      timestamp: Date.now(),
      level: "info",
    });

    quickTrade.mutate(
      { side, amount },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success(`Bet Placed!`, {
              description: `${side} outcome @ ${(side === "UP" ? result.btc_price : result.beat_price)?.toFixed(2)} - Order: ${result.order_id}`,
            });

            addLog({
              bot_id: 0,
              bot_name: "Manual Trade",
              message: `SUCCESS: ${side} bet placed for ${amount} USDC. Order ID: ${result.order_id}`,
              timestamp: Date.now(),
              level: "success",
            });

            setSelectedSide(null);
          } else {
            toast.error("Trade Failed", { description: result.message });
            addLog({
              bot_id: 0,
              bot_name: "Manual Trade",
              message: `FAILED: ${result.message}`,
              timestamp: Date.now(),
              level: "error",
            });
            setSelectedSide(null);
          }
        },
        onError: (err) => {
          toast.error("Trade Failed", { description: String(err) });
          addLog({
            bot_id: 0,
            bot_name: "Manual Trade",
            message: `ERROR: ${String(err)}`,
            timestamp: Date.now(),
            level: "error",
          });
          setSelectedSide(null);
        },
      }
    );
  };

  const isLoading = quickTrade.isPending;

  const isAboveTarget = btcPrice >= beatPrice;
  const priceDiffPercent = btcPrice > 0 && beatPrice > 0
    ? ((btcPrice - beatPrice) / beatPrice) * 100
    : 0;

  return (
    <div
      className="glass-card"
      style={{
        padding: "1.5rem",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <LineChart size={20} style={{ color: "#6366f1" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "#fafafa" }}>Quick Trade</span>
        </div>

        {/* Current Prediction */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          borderRadius: 8,
          background: isAboveTarget ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
          border: `1px solid ${isAboveTarget ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
        }}>
          {isAboveTarget ? (
            <TrendingUp size={16} style={{ color: "#22c55e" }} />
          ) : (
            <TrendingDown size={16} style={{ color: "#ef4444" }} />
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: isAboveTarget ? "#22c55e" : "#ef4444" }}>
            {isAboveTarget ? "UP" : "DOWN"} @ {priceDiffPercent >= 0 ? "+" : ""}{priceDiffPercent.toFixed(3)}%
          </span>
        </div>
      </div>

      {/* Chart - TradingView Widget */}
      <div
        style={{
          flex: 1,
          borderRadius: 12,
          background: "#0b0b0f",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          minHeight: 300,
          overflow: "hidden",
        }}
      >
        <TradingViewWidget
          symbol="BINANCE:BTCUSDT"
          interval="5"
          height={300}
        />
      </div>

      {/* Amount input */}
      <div style={{ margin: "1rem 0" }}>
        <label style={{ fontSize: 12, color: "#71717a", marginBottom: "0.5rem", display: "block" }}>
          Bet Amount (USDC)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Math.min(1000, Number(e.target.value))))}
          min={1}
          max={1000}
          step={1}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(20, 20, 28, 0.6)",
            color: "#fafafa",
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />
      </div>

      {/* Trade buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <motion.button
          type="button"
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
          onClick={() => handleTrade("UP")}
          disabled={isLoading}
          className={`trade-btn trade-btn-up ${selectedSide === "UP" ? "trade-btn-up-active" : ""}`}
          style={{ opacity: isLoading && selectedSide !== "UP" ? 0.5 : 1 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            {isLoading && selectedSide === "UP" ? <Loader2 size={20} className="animate-spin" /> : <TrendingUp size={20} />}
            <span style={{ fontWeight: 700, fontSize: 18 }}>UP</span>
          </div>
          <span style={{ fontSize: 12, color: "rgba(34, 197, 94, 0.7)" }}>
            BTC rises in 5 minutes
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
          onClick={() => handleTrade("DOWN")}
          disabled={isLoading}
          className={`trade-btn trade-btn-down ${selectedSide === "DOWN" ? "trade-btn-down-active" : ""}`}
          style={{ opacity: isLoading && selectedSide !== "DOWN" ? 0.5 : 1 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            {isLoading && selectedSide === "DOWN" ? <Loader2 size={20} className="animate-spin" /> : <TrendingDown size={20} />}
            <span style={{ fontWeight: 700, fontSize: 18 }}>DOWN</span>
          </div>
          <span style={{ fontSize: 12, color: "rgba(239, 68, 68, 0.7)" }}>
            BTC falls in 5 minutes
          </span>
        </motion.button>
      </div>
    </div>
  );
}