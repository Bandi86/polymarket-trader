"use client";

import { motion } from "framer-motion";
import { Clock, TrendingUp, TrendingDown, Play, Square, Wallet, Zap, Trophy, Activity, Target, Flame, Bitcoin, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAppStore } from "@/store";
import { useRunAllBots, useStopAllBots } from "@/hooks/use-api";
import { toast } from "sonner";

function formatBTCPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return price.toFixed(2);
}

function formatPriceDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}`;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function CompactDataBar() {
  const { btcPrice, startPrice, priceDelta, yesPrice, noPrice, timeRemaining, bots, systemStatus, positions } = useAppStore();
  const runAllBots = useRunAllBots();
  const stopAllBots = useStopAllBots();

  const isBotRunning = (systemStatus?.bots_running ?? 0) > 0;
  const activeBots = bots.filter(b => b.status === "running").length;
  const totalBots = bots.length;

  // Calculate stats from positions
  const totalPnl = systemStatus?.total_pnl ?? 0;
  const totalTrades = positions.length;
  const totalExposure = positions.reduce((sum, p) => sum + p.stake, 0);

  // Market prediction: YES = "BTC will exceed target", NO = "BTC will stay below target"
  const marketPrediction = yesPrice > 0.5 ? "EXCEED" : "STAY BELOW";
  const confidence = Math.abs(yesPrice - 0.5) * 100;

  // Current status relative to target
  const deltaColor = priceDelta >= 0 ? "#22c55e" : "#ef4444";

  const handleRunAll = async () => {
    runAllBots.mutate(undefined, {
      onSuccess: () => toast.success("All bots started"),
      onError: (err) => toast.error("Failed to start bots", { description: String(err) }),
    });
  };

  const handleStopAll = async () => {
    stopAllBots.mutate(undefined, {
      onSuccess: () => toast.success("All bots stopped"),
      onError: (err) => toast.error("Failed to stop bots", { description: String(err) }),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "rgba(10, 15, 25, 0.7)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* ROW 1: Timer + Price Target + YES/NO Odds + Controls */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
        padding: "1rem 1.5rem",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Timer */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: timeRemaining < 60
              ? "rgba(239, 68, 68, 0.15)"
              : timeRemaining < 180
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(34, 197, 94, 0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${timeRemaining < 60
              ? "rgba(239, 68, 68, 0.3)"
              : timeRemaining < 180
                ? "rgba(245, 158, 11, 0.3)"
                : "rgba(34, 197, 94, 0.3)"}`
          }}>
            <Clock style={{ width: 22, height: 22, color: timeRemaining < 60 ? "#ef4444" : timeRemaining < 180 ? "#f59e0b" : "#22c55e" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Ends In
            </div>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#fafafa" }}>
              {timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : "--:--"}
            </span>
          </div>
        </div>

        <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.08)" }} />

        {/* Target Price vs Current Price */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Target Price (Price to Beat) */}
          <div style={{
            padding: "0.5rem 1rem",
            borderRadius: 10,
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Target style={{ width: 14, height: 14, color: "#818cf8" }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#818cf8", textTransform: "uppercase" }}>
                TARGET
              </span>
            </div>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#818cf8" }}>
              ${startPrice > 0 ? formatBTCPrice(startPrice) : "---"}
            </span>
          </div>

          {/* Delta Arrow */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            background: priceDelta >= 0 ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${priceDelta >= 0 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
          }}>
            {priceDelta !== 0 && (
              <motion.div
                key={priceDelta}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {priceDelta >= 0
                  ? <ArrowUpRight style={{ width: 16, height: 16, color: "#22c55e" }} />
                  : <ArrowDownRight style={{ width: 16, height: 16, color: "#ef4444" }} />
                }
              </motion.div>
            )}
            <span style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              color: deltaColor,
            }}>
              {priceDelta !== 0 ? formatPriceDelta(priceDelta) : "---"}
            </span>
          </div>

          {/* Current BTC Price */}
          <div style={{
            padding: "0.5rem 1rem",
            borderRadius: 10,
            background: "rgba(247, 147, 26, 0.1)",
            border: "1px solid rgba(247, 147, 26, 0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Bitcoin style={{ width: 14, height: 14, color: "#f7931a" }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#f7931a", textTransform: "uppercase" }}>
                CURRENT
              </span>
            </div>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#f7931a" }}>
              ${btcPrice > 0 ? formatBTCPrice(btcPrice) : "---"}
            </span>
          </div>
        </div>

        <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.08)" }} />

        {/* YES/NO Odds - Market Prediction */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <motion.div
            key={`yes-${yesPrice}`}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: 10,
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <TrendingUp style={{ width: 16, height: 16, color: "#22c55e" }} />
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#22c55e" }}>YES</span>
            </div>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#22c55e", fontFamily: "'JetBrains Mono', monospace" }}>
              {(yesPrice * 100).toFixed(1)}¢
            </span>
          </motion.div>
          <motion.div
            key={`no-${noPrice}`}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: 10,
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <TrendingDown style={{ width: 16, height: 16, color: "#ef4444" }} />
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ef4444" }}>NO</span>
            </div>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>
              {(noPrice * 100).toFixed(1)}¢
            </span>
          </motion.div>
        </div>

        {/* Market Prediction Indicator */}
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: 10,
          background: marketPrediction === "EXCEED" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
          border: `1px solid ${marketPrediction === "EXCEED" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
          maxWidth: 180,
        }}>
          <div style={{ fontSize: "0.65rem", color: "#71717a", textTransform: "uppercase", marginBottom: "0.25rem" }}>
            Market Predicts
          </div>
          <div style={{
            fontSize: "0.9rem",
            fontWeight: 700,
            color: marketPrediction === "EXCEED" ? "#22c55e" : "#ef4444",
          }}>
            {marketPrediction === "EXCEED" ? "BTC WILL EXCEED TARGET" : "BTC WILL STAY BELOW"}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#71717a", marginTop: "0.25rem" }}>
            {confidence.toFixed(1)}% confidence
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto" }}>
          <motion.button
            whileHover={{ scale: isBotRunning ? 1 : 1.03 }}
            whileTap={{ scale: isBotRunning ? 1 : 0.97 }}
            onClick={handleRunAll}
            disabled={isBotRunning || runAllBots.isPending}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.1rem",
              borderRadius: 10, border: "none",
              background: isBotRunning ? "rgba(34, 197, 94, 0.1)" : "linear-gradient(135deg, #22c55e, #16a34a)",
              color: isBotRunning ? "#22c55e" : "white",
              fontWeight: 700, cursor: isBotRunning ? "not-allowed" : "pointer", fontSize: "0.85rem",
              boxShadow: isBotRunning ? "none" : "0 4px 16px rgba(34, 197, 94, 0.3)",
              opacity: isBotRunning ? 0.7 : 1,
            }}
          >
            <Play style={{ width: 14, height: 14 }} fill={!isBotRunning ? "currentColor" : "none"} />
            RUN ALL
          </motion.button>

          <motion.button
            whileHover={{ scale: !isBotRunning ? 1 : 1.03 }}
            whileTap={{ scale: !isBotRunning ? 1 : 0.97 }}
            onClick={handleStopAll}
            disabled={!isBotRunning || stopAllBots.isPending}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.1rem",
              borderRadius: 10, border: isBotRunning ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: isBotRunning ? "rgba(239, 68, 68, 0.1)" : "transparent",
              color: isBotRunning ? "#ef4444" : "#71717a",
              fontWeight: 700, cursor: !isBotRunning ? "not-allowed" : "pointer", fontSize: "0.85rem",
              opacity: !isBotRunning ? 0.5 : 1,
            }}
          >
            <Square style={{ width: 14, height: 14 }} />
            STOP ALL
          </motion.button>
        </div>
      </div>

      {/* ROW 2: Stats */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
        padding: "0.75rem 1.5rem",
        background: "rgba(0,0,0,0.2)",
      }}>
        {/* P&L */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: totalPnl >= 0 ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: totalPnl >= 0 ? "1px solid rgba(34, 197, 94, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)"
          }}>
            <Trophy style={{ width: 16, height: 16, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.6rem", color: "#71717a" }}>P&L</div>
            <span style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Trades */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(167, 139, 250, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(167, 139, 250, 0.2)" }}>
            <Activity style={{ width: 16, height: 16, color: "#a78bfa" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.6rem", color: "#71717a" }}>Trades</div>
            <span style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              {totalTrades}
            </span>
          </div>
        </div>

        {/* Exposure */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: totalExposure > 0 ? "rgba(245, 158, 11, 0.12)" : "rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: totalExposure > 0 ? "1px solid rgba(245, 158, 11, 0.2)" : "1px solid rgba(255,255,255,0.08)"
          }}>
            <Target style={{ width: 16, height: 16, color: totalExposure > 0 ? "#f59e0b" : "#71717a" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.6rem", color: "#71717a" }}>Exposure</div>
            <span style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: totalExposure > 0 ? "#f59e0b" : "#71717a" }}>
              ${totalExposure.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Bots */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99, 102, 241, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
            <Zap style={{ width: 16, height: 16, color: "#6366f1" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.6rem", color: "#71717a" }}>Bots</div>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: isBotRunning ? "#22c55e" : "#71717a" }}>
              {activeBots}/{totalBots}
            </span>
          </div>
        </div>

        {/* Positions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59, 130, 246, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
            <Wallet style={{ width: 16, height: 16, color: "#3b82f6" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.6rem", color: "#71717a" }}>Positions</div>
            <span style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              {positions.length}
            </span>
          </div>
        </div>

        {/* Running Indicator */}
        {isBotRunning && (
          <>
            <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)" }} />
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 0.8rem",
                borderRadius: 10,
                background: "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                border: "1px solid rgba(34, 197, 94, 0.4)",
              }}
            >
              <Flame style={{ width: 16, height: 16, color: "#22c55e" }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.6rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Running
                </span>
                <span style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#22c55e",
                  lineHeight: 1,
                }}>
                  {activeBots} active
                </span>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}