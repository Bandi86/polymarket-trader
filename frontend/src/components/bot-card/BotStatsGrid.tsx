import { Flame, Snowflake, Zap } from "lucide-react";

interface BotStatsGridProps {
  winRate: number;
  trades: number;
  wins: number;
  losses: number;
  currentStreak: { type: "win" | "loss" | "none"; count: number };
  avgWin?: number;
  avgLoss?: number;
}

export function BotStatsGrid({
  winRate = 0,
  trades = 0,
  wins = 0,
  losses = 0,
  currentStreak,
  avgWin = 0,
  avgLoss = 0,
}: BotStatsGridProps) {
  // Expected Value: EV = (winRate * avgWin) - ((1 - winRate) * avgLoss)
  const winRateDecimal = winRate / 100;
  const ev = trades > 0
    ? (winRateDecimal * avgWin) - ((1 - winRateDecimal) * avgLoss)
    : 0;
  const evPositive = ev >= 0;

  // Hot streak gradient border
  const isHotStreak = currentStreak.type === "win" && currentStreak.count >= 3;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "0.5rem",
      marginBottom: "1rem",
    }}>
      {/* Win Rate */}
      <div style={{
        padding: "0.625rem",
        background: isHotStreak
          ? "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))"
          : "rgba(0,0,0,0.2)",
        borderRadius: 8,
        textAlign: "center",
        border: isHotStreak ? "1px solid rgba(34, 197, 94, 0.3)" : "none",
      }}>
        <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Win Rate</div>
        <div style={{
          fontWeight: 700,
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.875rem",
          color: winRate >= 50 ? "#22c55e" : winRate > 0 ? "#f59e0b" : "var(--text-muted)",
        }}>
          {winRate.toFixed(0)}%
        </div>
      </div>

      {/* Trades */}
      <div style={{
        padding: "0.625rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 8,
        textAlign: "center",
      }}>
        <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Trades</div>
        <div style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "0.875rem" }}>
          {trades}
        </div>
        <div style={{ fontSize: "0.625rem", fontWeight: 500 }}>
          <span style={{ color: "#22c55e" }}>{wins}W</span>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ color: "#ef4444" }}>{losses}L</span>
        </div>
      </div>

      {/* Streak */}
      <div style={{
        padding: "0.625rem",
        background: currentStreak.type === "win" && currentStreak.count >= 3
          ? "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))"
          : "rgba(0,0,0,0.2)",
        borderRadius: 8,
        textAlign: "center",
        border: currentStreak.type === "win" && currentStreak.count >= 3
          ? "1px solid rgba(245, 158, 11, 0.3)"
          : "none",
      }}>
        <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Streak</div>
        <div style={{
          fontWeight: 700,
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.2rem",
          color: currentStreak.type === "win" ? "#f59e0b" : currentStreak.type === "loss" ? "#3b82f6" : "var(--text-muted)",
        }}>
          {currentStreak.type === "win" && <Flame style={{ width: 14, height: 14 }} />}
          {currentStreak.type === "loss" && <Snowflake style={{ width: 14, height: 14 }} />}
          {currentStreak.count > 0 ? currentStreak.count : "-"}
        </div>
      </div>

      {/* Expected Value (EV) */}
      <div style={{
        padding: "0.625rem",
        background: trades > 0
          ? evPositive
            ? "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.03))"
            : "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.03))"
          : "rgba(0,0,0,0.2)",
        borderRadius: 8,
        textAlign: "center",
        border: trades > 0
          ? evPositive
            ? "1px solid rgba(34, 197, 94, 0.2)"
            : "1px solid rgba(239, 68, 68, 0.2)"
          : "none",
      }}>
        <div style={{
          fontSize: "0.625rem",
          color: "var(--text-muted)",
          marginBottom: "0.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.2rem",
        }}>
          <Zap style={{ width: 10, height: 10 }} />
          EV
        </div>
        <div style={{
          fontWeight: 700,
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.875rem",
          color: trades > 0
            ? evPositive ? "#22c55e" : "#ef4444"
            : "var(--text-muted)",
        }}>
          {trades > 0 ? `${evPositive ? "+" : ""}$${ev.toFixed(2)}` : "-"}
        </div>
      </div>
    </div>
  );
}