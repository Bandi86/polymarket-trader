"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Bot,
  Play,
  Square,
  Activity,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { useAppStore } from "@/store";
import { toast } from "sonner";
import type { Bot as BotType, StrategyType } from "@/types";

type BotConfig = BotType & {
  pnl?: number;
  trades_count?: number;
  win_rate?: number;
};

const STRATEGIES: { id: StrategyType; name: string; description: string }[] = [
  { id: "momentum", name: "Momentum", description: "BTC momentum alapú kereskedés" },
  { id: "mean_reversion", name: "Mean Reversion", description: "Trend forduló pontokon kereskedés" },
  { id: "last_seconds_scalp", name: "Scalping", description: "Rövid pozíciók, gyors profit" },
  { id: "binance_signal", name: "Binance Signal", description: "Binance szignál alapú" },
];

export default function BotsPage() {
  const router = useRouter();
  const { isAuthenticated, setBots } = useAppStore();
  const [botConfigs, setBotConfigs] = useState<BotConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [newBotStrategy, setNewBotStrategy] = useState<StrategyType>("momentum");
  const [newBotBetSize, setNewBotBetSize] = useState(10);

  useEffect(() => {
    // Check both store state and localStorage for auth
    const hasToken = typeof window !== "undefined" && localStorage.getItem("token");
    if (!isAuthenticated && !hasToken) {
      router.push("/login");
      return;
    }
    loadBotConfigs();
  }, [isAuthenticated, router]);

  const loadBotConfigs = async () => {
    try {
      const configs = await apiFetch<BotConfig[]>("/bots", { method: "GET" });
      setBotConfigs(configs);
      // Map to store Bot format
      setBots(configs.map((c) => ({
        id: c.id,
        name: c.name,
        strategy: c.strategy,
        enabled: c.enabled,
        status: c.status,
        bet_size: c.bet_size,
        max_bet: c.max_bet,
        use_kelly: c.use_kelly,
        kelly_fraction: c.kelly_fraction,
        interval_seconds: c.interval_seconds,
        created_at: c.created_at,
      })));
    } catch (err) {
      // If no bots yet, show empty state
      setBotConfigs([]);
    }
  };

  const startBot = async (botId: number) => {
    setLoading(true);
    try {
      await apiFetch(`/bots/${botId}/start`, { method: "POST" });
      toast.success("Bot elindítva!");
      loadBotConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bot indítása sikertelen");
    } finally {
      setLoading(false);
    }
  };

  const stopBot = async (botId: number) => {
    setLoading(true);
    try {
      await apiFetch(`/bots/${botId}/stop`, { method: "POST" });
      toast.success("Bot leállítva!");
      loadBotConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bot leállítása sikertelen");
    } finally {
      setLoading(false);
    }
  };

  const createBot = async () => {
    if (!newBotName.trim()) {
      toast.error("Kérlek adj meg egy nevet a botnak");
      return;
    }

    setLoading(true);
    try {
      await apiFetch<BotConfig>("/bots", {
        method: "POST",
        body: JSON.stringify({
          name: newBotName,
          strategy: newBotStrategy,
          bet_size: newBotBetSize,
          max_bet: 100,
          use_kelly: false,
          kelly_fraction: 0.5,
          interval_seconds: 300,
        }),
      });
      toast.success("Bot létrehozva!");
      setShowCreateModal(false);
      setNewBotName("");
      setNewBotStrategy("momentum");
      setNewBotBetSize(10);
      loadBotConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bot létrehozása sikertelen");
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (botId: number) => {
    try {
      await apiFetch(`/bots/${botId}`, { method: "DELETE" });
      toast.success("Bot törölve!");
      loadBotConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bot törlése sikertelen");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "#22c55e";
      case "paused":
        return "#f59e0b";
      case "error":
        return "#ef4444";
      default:
        return "#71717a";
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0f",
        padding: "2rem",
        position: "relative",
      }}
    >
      {/* Ambient glow */}
      <div
        className="ambient-glow ambient-glow-primary"
        style={{ width: 600, height: 600, top: "10%", left: "20%" }}
      />
      <div
        className="ambient-glow ambient-glow-green"
        style={{ width: 400, height: 400, bottom: "20%", right: "10%" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 1000, margin: "0 auto" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(99, 102, 241, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bot size={24} style={{ color: "#6366f1" }} />
            </div>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 24, color: "#fafafa" }}>Botok</h1>
              <span style={{ fontSize: 14, color: "#71717a" }}>Trading botok kezelése</span>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Plus size={16} />
            Új bot
          </motion.button>
        </div>

        {/* Stats summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Aktív botok</span>
            <span className="price-ticker" style={{ fontSize: 24, fontWeight: 700, color: "#22c55e", display: "block", marginTop: 8 }}>
              {botConfigs.filter((b) => b.status === "running").length}
            </span>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Összes PnL</span>
            <span className="price-ticker" style={{ fontSize: 24, fontWeight: 700, color: "#fafafa", display: "block", marginTop: 8 }}>
              ${botConfigs.reduce((sum, b) => sum + (b.pnl ?? 0), 0).toFixed(2)}
            </span>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Trades</span>
            <span className="price-ticker" style={{ fontSize: 24, fontWeight: 700, color: "#fafafa", display: "block", marginTop: 8 }}>
              {botConfigs.reduce((sum, b) => sum + (b.trades_count ?? 0), 0)}
            </span>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Avg Win Rate</span>
            <span className="price-ticker" style={{ fontSize: 24, fontWeight: 700, color: "#fafafa", display: "block", marginTop: 8 }}>
              {botConfigs.length > 0 && botConfigs.some(b => b.win_rate !== undefined)
                ? `${(botConfigs.filter(b => b.win_rate !== undefined).reduce((sum, b) => sum + (b.win_rate ?? 0), 0) / botConfigs.filter(b => b.win_rate !== undefined).length * 100).toFixed(1)}%`
                : "---"}
            </span>
          </div>
        </div>

        {/* Bot cards */}
        <AnimatePresence>
          {botConfigs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card"
              style={{ padding: "3rem", textAlign: "center" }}
            >
              <Bot size={48} style={{ color: "#71717a", marginBottom: "1rem" }} />
              <h3 style={{ fontWeight: 600, fontSize: 16, color: "#fafafa", marginBottom: "0.5rem" }}>
                Nincs bot konfiguráció
              </h3>
              <span style={{ fontSize: 14, color: "#71717a" }}>
                Hozzon létre egy új trading botot a kezdéshez
              </span>
            </motion.div>
          ) : (
            botConfigs.map((bot) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-card"
                style={{ padding: "1.5rem", marginBottom: "1rem" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {/* Left: Bot info */}
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: bot.status === "running"
                          ? "rgba(34, 197, 94, 0.15)"
                          : bot.status === "error"
                          ? "rgba(239, 68, 68, 0.15)"
                          : "rgba(99, 102, 241, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Activity size={20} style={{ color: getStatusColor(bot.status) }} />
                    </div>
                    <div>
                      <h3 style={{ fontWeight: 600, fontSize: 16, color: "#fafafa" }}>{bot.name}</h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "0.25rem 0.5rem",
                            borderRadius: 4,
                            background: bot.status === "running"
                              ? "rgba(34, 197, 94, 0.15)"
                              : bot.status === "error"
                              ? "rgba(239, 68, 68, 0.15)"
                              : "rgba(113, 113, 122, 0.15)",
                            color: getStatusColor(bot.status),
                          }}
                        >
                          {bot.status.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12, color: "#71717a" }}>{bot.strategy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Stats */}
                  <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 12, color: "#71717a" }}>PnL</span>
                      <span
                        className="price-ticker"
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: (bot.pnl ?? 0) >= 0 ? "#22c55e" : "#ef4444",
                          display: "block",
                        }}
                      >
                        {(bot.pnl ?? 0) >= 0 ? "+" : ""}${(bot.pnl ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 12, color: "#71717a" }}>Trades</span>
                      <span className="price-ticker" style={{ fontSize: 16, fontWeight: 600, color: "#fafafa", display: "block" }}>
                        {bot.trades_count ?? 0}
                      </span>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 12, color: "#71717a" }}>Win Rate</span>
                      <span className="price-ticker" style={{ fontSize: 16, fontWeight: 600, color: "#fafafa", display: "block" }}>
                        {bot.win_rate !== undefined ? `${(bot.win_rate * 100).toFixed(1)}%` : "---"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {bot.status === "running" ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => stopBot(bot.id)}
                        disabled={loading}
                        className="btn-red"
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
                        Leállítás
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => startBot(bot.id)}
                        disabled={loading}
                        className="btn-green"
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        Indítás
                      </motion.button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteBot(bot.id)}
                      style={{
                        padding: "0.5rem",
                        borderRadius: 8,
                        color: "#71717a",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </motion.div>

      {/* Create bot modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
            }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-card"
              style={{ padding: "2rem", width: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontWeight: 600, fontSize: 18, color: "#fafafa", marginBottom: "1.5rem" }}>
                Új bot létrehozása
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: 14, color: "#a1a1aa", marginBottom: "0.5rem", display: "block" }}>
                    Bot neve
                  </label>
                  <input
                    type="text"
                    value={newBotName}
                    onChange={(e) => setNewBotName(e.target.value)}
                    className="input"
                    placeholder="My Trading Bot"
                  />
                </div>

                <div>
                  <label style={{ fontSize: 14, color: "#a1a1aa", marginBottom: "0.5rem", display: "block" }}>
                    Tét méret ($)
                  </label>
                  <input
                    type="number"
                    value={newBotBetSize}
                    onChange={(e) => setNewBotBetSize(Number(e.target.value))}
                    className="input"
                    placeholder="10"
                    min={1}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 14, color: "#a1a1aa", marginBottom: "0.5rem", display: "block" }}>
                    Stratégia
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {STRATEGIES.map((strat) => (
                      <motion.button
                        key={strat.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setNewBotStrategy(strat.id)}
                        style={{
                          padding: "1rem",
                          borderRadius: 8,
                          background: newBotStrategy === strat.id
                            ? "rgba(99, 102, 241, 0.15)"
                            : "rgba(20, 20, 28, 0.6)",
                          border: newBotStrategy === strat.id
                            ? "1px solid rgba(99, 102, 241, 0.3)"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#fafafa" }}>
                          {strat.name}
                        </span>
                        <span style={{ fontSize: 12, color: "#71717a", display: "block", marginTop: 4 }}>
                          {strat.description}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: 8,
                      fontSize: 14,
                      color: "#71717a",
                      background: "rgba(20, 20, 28, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    Mégse
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={createBot}
                    disabled={loading}
                    className="btn-primary"
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : "Létrehozás"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}