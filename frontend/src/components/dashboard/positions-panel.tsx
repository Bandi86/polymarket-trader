"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Layers, X, TrendingUp, TrendingDown } from "lucide-react";
import { useAppStore } from "@/store";
import { useCancelOrder } from "@/hooks/use-api";
import { toast } from "sonner";

export function PositionsPanel() {
  const { positions } = useAppStore();
  const cancelOrder = useCancelOrder();

  const formatPnl = (pnl?: number) => {
    if (pnl === undefined) return "---";
    const sign = pnl >= 0 ? "+" : "";
    return `${sign}$${pnl.toFixed(2)}`;
  };

  const handleClosePosition = async (positionId: string) => {
    cancelOrder.mutate(positionId, {
      onSuccess: () => {
        toast.success("Position closed");
      },
      onError: (err) => {
        toast.error("Failed to close position", { description: String(err) });
      },
    });
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: "1rem",
        height: 300,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Layers size={16} style={{ color: "#6366f1" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "#fafafa" }}>Positions</span>
        </div>
        <span
          style={{
            fontSize: 12,
            padding: "0.25rem 0.5rem",
            borderRadius: 4,
            background: "rgba(20, 20, 28, 0.6)",
            color: "#71717a",
          }}
        >
          {positions.length} active
        </span>
      </div>

      {/* Positions list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <AnimatePresence initial={false}>
          {positions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#71717a" }}>
              <Layers size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
              <span style={{ fontSize: 12 }}>No active positions</span>
            </div>
          ) : (
            positions.map((position) => (
              <motion.div
                key={position.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  padding: "0.75rem",
                  borderRadius: 8,
                  background: "rgba(20, 20, 28, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  marginBottom: 8,
                }}
              >
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {position.outcome === "YES" ? (
                      <TrendingUp size={16} style={{ color: "#22c55e" }} />
                    ) : (
                      <TrendingDown size={16} style={{ color: "#ef4444" }} />
                    )}
                    <span
                      className={`badge ${position.outcome === "YES" ? "badge-green" : "badge-red"}`}
                    >
                      {position.outcome === "YES" ? "UP" : "DOWN"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClosePosition(String(position.id))}
                    disabled={cancelOrder.isPending}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#71717a",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#71717a" }}>Amount</span>
                    <span className="price-ticker" style={{ color: "#fafafa", marginLeft: 4 }}>
                      {position.amount.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#71717a" }}>Odds</span>
                    <span className="price-ticker" style={{ color: "#fafafa", marginLeft: 4 }}>
                      {(position.odds * 100).toFixed(0)}¢
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#71717a" }}>Stake</span>
                    <span className="price-ticker" style={{ color: "#fafafa", marginLeft: 4 }}>
                      ${position.stake.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#71717a" }}>PnL</span>
                    <span
                      className="price-ticker"
                      style={{
                        marginLeft: 4,
                        color: (position.pnl ?? 0) >= 0 ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {formatPnl(position.pnl)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}