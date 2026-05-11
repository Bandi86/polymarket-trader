import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface BotBalanceCardProps {
  balance: number;
  initialBalance: number;
  balanceGrowth: number;
  growthPercent: number;
  tradingMode?: "demo" | "live";
}

export function BotBalanceCard({
  balance,
  initialBalance,
  balanceGrowth,
  growthPercent,
  tradingMode = "demo",
}: BotBalanceCardProps) {
  const isPositive = balanceGrowth >= 0;
  const isLiveMode = tradingMode === "live";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem",
        background: isLiveMode
          ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))"
          : isPositive
            ? "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))"
            : "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))",
        borderRadius: 12,
        marginBottom: "1rem",
        border: `1px solid ${isLiveMode ? "rgba(239, 68, 68, 0.4)" : isPositive ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
      }}
    >
      <div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginBottom: "0.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {isLiveMode && (
            <span
              style={{
                background: "#ef4444",
                color: "white",
                padding: "0.1rem 0.3rem",
                borderRadius: 3,
                fontSize: "0.6rem",
                fontWeight: 700,
              }}
            >
              LIVE
            </span>
          )}
          {isLiveMode ? "Live Account" : "Bot Balance"}
        </div>
        <div
          style={{
            fontWeight: 700,
            fontFamily: "ui-monospace, monospace",
            fontSize: "1.5rem",
            color: isLiveMode ? "#ef4444" : "var(--text-primary)",
          }}
        >
          ${(balance ?? 0).toFixed(2)}
        </div>
        {!isLiveMode && (
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Started: ${(initialBalance ?? 0).toFixed(2)}
          </div>
        )}
      </div>
      {!isLiveMode && (
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.25rem",
              color: isPositive ? "#22c55e" : "#ef4444",
            }}
          >
            {isPositive ? (
              <ArrowUpRight style={{ width: 20, height: 20 }} />
            ) : (
              <ArrowDownRight style={{ width: 20, height: 20 }} />
            )}
            <span style={{ fontWeight: 700, fontSize: "1.125rem" }}>
              {isPositive ? "+" : ""}
              {(balanceGrowth ?? 0).toFixed(2)}
            </span>
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: isPositive ? "#22c55e" : "#ef4444",
            }}
          >
            ({isPositive ? "+" : ""}
            {(growthPercent ?? 0).toFixed(1)}%)
          </div>
        </div>
      )}
    </div>
  );
}
