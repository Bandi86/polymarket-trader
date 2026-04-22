"use client";

import { motion } from "framer-motion";
import { Bell, Wallet, Activity, Bitcoin } from "lucide-react";
import { BotSelector } from "@/components/dashboard/bot-selector";
import { useAppStore } from "@/store";

export function Header() {
  const { btcPrice, systemStatus } = useAppStore();

  const runningBots = 0;
  const totalPnl = systemStatus?.total_pnl ?? 0;

  const formatPrice = (p: number) =>
    p > 0 ? `$${p.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "---";

  return (
    <header className="glass-card" style={{ margin: 0, borderRadius: 0, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
      <div style={{ padding: "1rem 1.5rem" }} className="flex items-center justify-between gap-4">
        {/* Bot Selector */}
        <BotSelector />

        {/* Stats */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          {/* BTC Price */}
          <div className="stat-card" style={{ borderColor: "rgba(247, 147, 26, 0.3)" }}>
            <Activity size={16} style={{ color: "#f7931a" }} />
            <div>
              <span className="stat-label">BTC Ár</span>
              <motion.span
                key={btcPrice}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.3 }}
                className="stat-value"
                style={{ color: "#f7931a" }}
              >
                {formatPrice(btcPrice)}
              </motion.span>
            </div>
          </div>

          {/* Running Bots */}
          <div className="stat-card">
            <Activity size={16} style={{ color: "#22c55e" }} />
            <div>
              <span className="stat-label">Futó Botok</span>
              <span className="stat-value">
                {runningBots} / 0
              </span>
            </div>
          </div>

          {/* Total PnL */}
          <div className="stat-card">
            <Wallet size={16} style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }} />
            <div>
              <span className="stat-label">Összes PnL</span>
              <span className="stat-value" style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button
            type="button"
            className="glass-card"
            style={{ padding: "0.5rem", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Bell size={20} style={{ color: "#a1a1aa" }} />
          </button>

          {/* BTC Ticker */}
          <div
            className="glass-card"
            style={{
              padding: "0.5rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              borderColor: "rgba(247, 147, 26, 0.3)",
            }}
          >
            <Bitcoin size={18} style={{ color: "#f7931a" }} />
            <motion.span
              key={btcPrice}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.4 }}
              className="price-ticker"
              style={{ fontWeight: 700, fontSize: 16 }}
            >
              {formatPrice(btcPrice)}
            </motion.span>
          </div>
        </div>
      </div>
    </header>
  );
}