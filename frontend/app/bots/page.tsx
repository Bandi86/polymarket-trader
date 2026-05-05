"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bot,
  Loader2,
  Play,
  Plus,
  Shield,
  Square,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import { useAppStore } from "@/store";
import type { Bot as BotType, StrategyType } from "@/types";

type PortfolioData = {
  balance: number;
  initial_balance: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  win_rate: number;
  roi_percent: number;
};

type BotConfig = BotType & {
  pnl?: number;
  trades_count?: number;
  win_rate?: number;
  portfolio?: PortfolioData;
};

const STRATEGIES: { id: StrategyType; name: string; description: string }[] = [
  { id: "momentum", name: "Momentum", description: "BTC momentum alapú kereskedés" },
  {
    id: "mean_reversion",
    name: "Mean Reversion",
    description: "Trend forduló pontokon kereskedés",
  },
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

  const loadBotConfigs = useCallback(async () => {
    try {
      const configs = await apiFetch<BotConfig[]>("/bots", { method: "GET" });

      // Load portfolio data for each bot
      const configsWithPortfolio = await Promise.all(
        configs.map(async (bot) => {
          try {
            const portfolio = await apiFetch<PortfolioData>(`/bots/${bot.id}/portfolio`);
            return { ...bot, portfolio };
          } catch {
            return bot;
          }
        })
      );

      setBotConfigs(configsWithPortfolio);
      setBots(
        configsWithPortfolio.map((c) => ({
          id: c.id,
          name: c.name,
          strategy: (c.strategy_type || "momentum") as StrategyType,
          strategy_type: c.strategy_type || "momentum",
          trading_mode: c.trading_mode || "paper",
          market_id: c.market_id || "btc-5m",
          interval: c.interval || 300000,
          status: c.status,
          bet_size: c.bet_size,
          max_bet: c.max_bet,
          use_kelly: c.use_kelly,
          kelly_fraction: c.kelly_fraction,
          interval_seconds: (c.interval || 300000) / 1000,
          stop_loss: c.stop_loss ?? 0.1,
          take_profit: c.take_profit ?? 0.2,
          pnl: c.pnl,
          trades_count: c.trades_count,
          win_rate: c.win_rate,
          created_at: c.created_at,
        }))
      );
    } catch (_err) {
      // Silently fail
    }
  }, [setBots]);

  useEffect(() => {
    const hasToken = typeof window !== "undefined" && localStorage.getItem("token");
    if (!isAuthenticated && !hasToken) {
      router.push("/login");
      return;
    }
    void loadBotConfigs();
  }, [isAuthenticated, loadBotConfigs, router]);

  const startBot = async (botId: number) => {
    setLoading(true);
    try {
      await apiFetch(`/bots/${botId}/start`, {
        method: "POST",
        body: JSON.stringify({ initial_balance: 100 }),
      });
      toast.success("Bot elindítva!");
      await loadBotConfigs();
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
      await loadBotConfigs();
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

    const exists = botConfigs.some((b) => b.name.toLowerCase() === newBotName.toLowerCase());
    if (exists) {
      toast.error("Botnév már létezik. Válassz másik nevet.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch<BotConfig>("/bots", {
        method: "POST",
        body: JSON.stringify({
          name: newBotName,
          market_id: "btc-5m",
          strategy_type: newBotStrategy,
          params: "{}",
          bet_size: newBotBetSize,
          max_bet: 100,
          use_kelly: false,
          kelly_fraction: 0.5,
          interval: 300000,
          stop_loss: 0.1,
          take_profit: 0.2,
          trading_mode: "paper",
        }),
      });
      toast.success("Bot létrehozva!");
      setShowCreateModal(false);
      setNewBotName("");
      setNewBotStrategy("momentum");
      setNewBotBetSize(10);
      await loadBotConfigs();
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
      await loadBotConfigs();
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

  const totalPnl = botConfigs.reduce((sum, b) => sum + (b.portfolio?.total_pnl ?? b.pnl ?? 0), 0);
  const totalTrades = botConfigs.reduce(
    (sum, b) => sum + (b.portfolio?.total_trades ?? b.trades_count ?? 0),
    0
  );
  const totalWins = botConfigs.reduce((sum, b) => sum + (b.portfolio?.winning_trades ?? 0), 0);
  const totalLosses = botConfigs.reduce((sum, b) => sum + (b.portfolio?.losing_trades ?? 0), 0);
  const avgWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  return (
    <div
      style={{ minHeight: "100vh", background: "#0b0b0f", padding: "2rem", position: "relative" }}
    >
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
        style={{ maxWidth: 1100, margin: "0 auto" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2rem",
          }}
        >
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="glass-card" style={{ padding: "1rem" }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Aktív botok</span>
            <span
              className="price-ticker"
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#22c55e",
                display: "block",
                marginTop: 8,
              }}
            >
              {botConfigs.filter((b) => b.status === "running").length}
            </span>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Összes PnL</span>
            <span
              className="price-ticker"
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: totalPnl >= 0 ? "#22c55e" : "#ef4444",
                display: "block",
                marginTop: 8,
              }}
            >
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </span>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Trades</span>
            <span
              className="price-ticker"
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#fafafa",
                display: "block",
                marginTop: 8,
              }}
            >
              {totalTrades}
            </span>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Nyerés / Vesztés</span>
            <span style={{ fontSize: 18, fontWeight: 700, display: "block", marginTop: 8 }}>
              <span style={{ color: "#22c55e" }}>{totalWins}W</span>
              <span style={{ color: "#71717a", margin: "0 4px" }}>/</span>
              <span style={{ color: "#ef4444" }}>{totalLosses}L</span>
            </span>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <span style={{ fontSize: 12, color: "#71717a" }}>Avg Win Rate</span>
            <span
              className="price-ticker"
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#fafafa",
                display: "block",
                marginTop: 8,
              }}
            >
              {avgWinRate.toFixed(1)}%
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
              <h3
                style={{ fontWeight: 600, fontSize: 16, color: "#fafafa", marginBottom: "0.5rem" }}
              >
                Nincs bot konfiguráció
              </h3>
              <span style={{ fontSize: 14, color: "#71717a" }}>
                Hozzon létre egy új trading botot a kezdéshez
              </span>
            </motion.div>
          ) : (
            botConfigs.map((bot) => {
              const p = bot.portfolio;
              const pnl = p?.total_pnl ?? bot.pnl ?? 0;
              const trades = p?.total_trades ?? bot.trades_count ?? 0;
              const wins = p?.winning_trades ?? 0;
              const losses = p?.losing_trades ?? 0;
              const winRate = p?.win_rate ?? (bot.win_rate ? bot.win_rate * 100 : 0);
              const balance = p?.balance ?? 0;
              const initialBalance = p?.initial_balance ?? 0;

              // Estimate won/lost amounts
              const avgWin =
                wins > 0 && pnl > 0 ? (pnl + losses * bot.bet_size) / wins : bot.bet_size * 1.5;
              const wonAmount = wins * avgWin;
              const lostAmount = losses * bot.bet_size;

              return (
                <motion.div
                  key={bot.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="glass-card"
                  style={{ padding: "1.5rem", marginBottom: "1rem" }}
                >
                  {/* Top row: name + status + actions */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background:
                            bot.status === "running"
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
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <h3 style={{ fontWeight: 600, fontSize: 16, color: "#fafafa" }}>
                            {bot.name}
                          </h3>
                          {bot.trading_mode === "live" && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#ef4444",
                              }}
                            >
                              ⚡ LIVE
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginTop: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "0.25rem 0.5rem",
                              borderRadius: 4,
                              background:
                                bot.status === "running"
                                  ? "rgba(34, 197, 94, 0.15)"
                                  : "rgba(113, 113, 122, 0.15)",
                              color: getStatusColor(bot.status),
                            }}
                          >
                            {bot.status.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 12, color: "#71717a" }}>
                            {bot.strategy_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
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
                          {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Square size={16} />
                          )}
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
                          {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Play size={16} />
                          )}
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

                  {/* Stats grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "0.75rem",
                    }}
                  >
                    {/* Egyenleg */}
                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 8,
                        padding: "0.75rem",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          marginBottom: 6,
                        }}
                      >
                        <Wallet size={12} style={{ color: "#6366f1" }} />
                        <span style={{ fontSize: 11, color: "#71717a", fontWeight: 600 }}>
                          EGYENLEG
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#fafafa" }}>
                        ${balance.toFixed(2)}
                      </div>
                      {initialBalance > 0 && (
                        <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
                          Kezdő: ${initialBalance.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* PnL */}
                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 8,
                        padding: "0.75rem",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          marginBottom: 6,
                        }}
                      >
                        <Activity size={12} style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444" }} />
                        <span style={{ fontSize: 11, color: "#71717a", fontWeight: 600 }}>
                          ÖSSZES PnL
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: pnl >= 0 ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
                        {trades} trade
                      </div>
                    </div>

                    {/* Nyerések */}
                    <div
                      style={{
                        background: "rgba(34, 197, 94, 0.05)",
                        borderRadius: 8,
                        padding: "0.75rem",
                        border: "1px solid rgba(34, 197, 94, 0.1)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          marginBottom: 6,
                        }}
                      >
                        <TrendingUp size={12} style={{ color: "#22c55e" }} />
                        <span style={{ fontSize: 11, color: "#71717a", fontWeight: 600 }}>
                          NYERÉSEK
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>{wins}x</div>
                      <div style={{ fontSize: 11, color: "#22c55e", marginTop: 2, opacity: 0.7 }}>
                        ≈ +${wonAmount.toFixed(2)}
                      </div>
                    </div>

                    {/* Veszteségek */}
                    <div
                      style={{
                        background: "rgba(239, 68, 68, 0.05)",
                        borderRadius: 8,
                        padding: "0.75rem",
                        border: "1px solid rgba(239, 68, 68, 0.1)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          marginBottom: 6,
                        }}
                      >
                        <TrendingDown size={12} style={{ color: "#ef4444" }} />
                        <span style={{ fontSize: 11, color: "#71717a", fontWeight: 600 }}>
                          VESZTESÉGEK
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>
                        {losses}x
                      </div>
                      <div style={{ fontSize: 11, color: "#ef4444", marginTop: 2, opacity: 0.7 }}>
                        ≈ -${lostAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: Win rate bar + settings */}
                  <div
                    style={{
                      marginTop: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    {/* Win rate bar */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "#71717a" }}>Win Rate</span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: winRate >= 50 ? "#22c55e" : "#ef4444",
                          }}
                        >
                          {winRate.toFixed(1)}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 4,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.06)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${winRate}%`,
                            background: winRate >= 50 ? "#22c55e" : "#ef4444",
                            borderRadius: 2,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                    </div>

                    {/* Settings badges */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span style={{ fontSize: 10, color: "#71717a" }}>Tét</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#fafafa" }}>
                          ${bot.bet_size}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.15)",
                        }}
                      >
                        <Shield size={10} style={{ color: "#ef4444" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444" }}>
                          SL {((bot.stop_loss ?? 0.1) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "rgba(34, 197, 94, 0.08)",
                          border: "1px solid rgba(34, 197, 94, 0.15)",
                        }}
                      >
                        <Target size={10} style={{ color: "#22c55e" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e" }}>
                          TP {((bot.take_profit ?? 0.2) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
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
              <h3
                style={{ fontWeight: 600, fontSize: 18, color: "#fafafa", marginBottom: "1.5rem" }}
              >
                Új bot létrehozása
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label
                    htmlFor="new-bot-name"
                    style={{
                      fontSize: 14,
                      color: "#a1a1aa",
                      marginBottom: "0.5rem",
                      display: "block",
                    }}
                  >
                    Bot neve
                  </label>
                  <input
                    id="new-bot-name"
                    type="text"
                    value={newBotName}
                    onChange={(e) => setNewBotName(e.target.value)}
                    className="input"
                    placeholder="My Trading Bot"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-bot-bet-size"
                    style={{
                      fontSize: 14,
                      color: "#a1a1aa",
                      marginBottom: "0.5rem",
                      display: "block",
                    }}
                  >
                    Tét méret ($)
                  </label>
                  <input
                    id="new-bot-bet-size"
                    type="number"
                    value={newBotBetSize}
                    onChange={(e) => setNewBotBetSize(Number(e.target.value))}
                    className="input"
                    placeholder="10"
                    min={1}
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-bot-strategy"
                    style={{
                      fontSize: 14,
                      color: "#a1a1aa",
                      marginBottom: "0.5rem",
                      display: "block",
                    }}
                  >
                    Stratégia
                  </label>
                  <div
                    id="new-bot-strategy"
                    style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                  >
                    {STRATEGIES.map((strat) => (
                      <motion.button
                        key={strat.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setNewBotStrategy(strat.id)}
                        style={{
                          padding: "1rem",
                          borderRadius: 8,
                          background:
                            newBotStrategy === strat.id
                              ? "rgba(99, 102, 241, 0.15)"
                              : "rgba(20, 20, 28, 0.6)",
                          border:
                            newBotStrategy === strat.id
                              ? "1px solid rgba(99, 102, 241, 0.3)"
                              : "1px solid rgba(255, 255, 255, 0.08)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#fafafa" }}>
                          {strat.name}
                        </span>
                        <span
                          style={{ fontSize: 12, color: "#71717a", display: "block", marginTop: 4 }}
                        >
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
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                    }}
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
