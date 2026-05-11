// BotLastAction - Shows last decision action, reason, confidence

interface BotLastActionProps {
  action: "YES" | "NO" | "SKIP" | null;
  reason?: string;
  timestamp?: number;
  confidence?: number;
}

export function BotLastAction({ action, reason, timestamp, confidence }: BotLastActionProps) {
  if (!action && !reason) {
    return (
      <div
        style={{
          background: "rgba(0, 0, 0, 0.2)",
          padding: "0.5rem",
          borderRadius: 4,
          marginTop: "0.5rem",
        }}
      >
        <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>No recent action</span>
      </div>
    );
  }

  const actionColor = action === "YES" ? "#22c55e" : action === "NO" ? "#ef4444" : "#f59e0b";
  const timeAgo = timestamp ? formatTimeAgo(timestamp) : "";

  return (
    <div
      style={{
        background: "rgba(0, 0, 0, 0.2)",
        padding: "0.5rem",
        borderRadius: 4,
        marginTop: "0.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#888", fontSize: "0.65rem" }}>Last action:</span>
        {timeAgo && <span style={{ color: "#888", fontSize: "0.65rem" }}>⏱️ {timeAgo}</span>}
      </div>
      <div style={{ marginTop: "0.25rem" }}>
        {action && (
          <span
            style={{
              color: actionColor,
              fontWeight: 600,
              fontSize: "0.75rem",
            }}
          >
            {action === "SKIP" ? "⊘" : action}
            {confidence !== undefined && (
              <span style={{ opacity: 0.7 }}> @{(confidence * 100).toFixed(0)}%</span>
            )}
          </span>
        )}
        {reason && (
          <span
            style={{
              color: "#aaa",
              fontSize: "0.75rem",
              marginLeft: action ? "0.5rem" : 0,
            }}
          >
            "{truncateReason(reason)}"
          </span>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function truncateReason(reason: string, maxLength = 40): string {
  if (reason.length <= maxLength) return reason;
  return `${reason.slice(0, maxLength - 3)}...`;
}

export default BotLastAction;
