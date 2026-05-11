import { Bot, Clock, Timer } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface BotCardHeaderProps {
  bot: {
    id: string;
    name: string;
    strategy: string;
    enabled: boolean;
    runTime?: number;
  };
  strategyColor: string;
  health: { color: string; label: string };
  HealthIcon: typeof Bot;
  runningTime: number;
  timeRemaining?: number;
}

export function BotCardHeader({
  bot,
  strategyColor,
  health,
  HealthIcon,
  runningTime,
  timeRemaining,
}: BotCardHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Bot Icon with Status */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: bot.enabled ? `${strategyColor}20` : "var(--glass-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `2px solid ${bot.enabled ? strategyColor : "var(--border)"}`,
            position: "relative",
          }}
        >
          <Bot
            style={{
              width: 22,
              height: 22,
              color: bot.enabled ? strategyColor : "var(--text-muted)",
            }}
          />
          {/* Running indicator dot */}
          {bot.enabled && (
            <div
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#22c55e",
                border: "2px solid var(--bg)",
                animation: "pulse 2s infinite",
              }}
            />
          )}
        </div>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "1.125rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {bot.name}
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}
          >
            {/* Strategy Badge */}
            <span
              style={{
                padding: "0.15rem 0.5rem",
                borderRadius: 4,
                background: `${strategyColor}15`,
                color: strategyColor,
                fontWeight: 500,
                fontSize: "0.7rem",
              }}
            >
              {bot.strategy}
            </span>
            {/* Health Badge */}
            <span
              style={{
                padding: "0.15rem 0.5rem",
                borderRadius: 4,
                background: `${health.color}20`,
                color: health.color,
                display: "flex",
                alignItems: "center",
                gap: "0.2rem",
                fontWeight: 600,
                fontSize: "0.7rem",
              }}
            >
              <HealthIcon style={{ width: 10, height: 10 }} />
              {health.label}
            </span>
          </div>
        </div>
      </div>

      {/* Running Time */}
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.375rem 0.625rem",
            borderRadius: 8,
            background: bot.enabled ? "rgba(34, 197, 94, 0.15)" : "rgba(107, 114, 128, 0.15)",
          }}
        >
          <Clock style={{ width: 14, height: 14, color: bot.enabled ? "#22c55e" : "#6b7280" }} />
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: bot.enabled ? "#22c55e" : "#6b7280",
            }}
          >
            {bot.enabled ? formatDuration(runningTime) : "STOPPED"}
          </span>
        </div>
        {/* Market Timer */}
        {timeRemaining !== undefined && timeRemaining > 0 && bot.enabled && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
              background:
                timeRemaining < 60000
                  ? "rgba(239, 68, 68, 0.2)"
                  : timeRemaining < 180000
                    ? "rgba(245, 158, 11, 0.2)"
                    : "rgba(59, 130, 246, 0.2)",
            }}
          >
            <Timer
              style={{
                width: 12,
                height: 12,
                color:
                  timeRemaining < 60000
                    ? "#ef4444"
                    : timeRemaining < 180000
                      ? "#f59e0b"
                      : "#3b82f6",
              }}
            />
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.7rem",
                fontWeight: 600,
                color:
                  timeRemaining < 60000
                    ? "#ef4444"
                    : timeRemaining < 180000
                      ? "#f59e0b"
                      : "#3b82f6",
              }}
            >
              {formatDuration(timeRemaining)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
