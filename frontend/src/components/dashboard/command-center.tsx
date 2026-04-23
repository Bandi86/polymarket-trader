"use client";

import { motion } from "framer-motion";
import { CompactDataBar } from "@/components/dashboard/compact-data-bar";
import { TradingPanel } from "@/components/dashboard/trading-panel";
import { PositionsPanel } from "@/components/dashboard/positions-panel";
import { TerminalLog } from "@/components/dashboard/terminal-log";

export function CommandCenter() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Top: Compact Data Bar with all key info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CompactDataBar />
      </motion.div>

      {/* Main Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "1rem",
        }}
      >
        {/* Left: Trading Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ minHeight: 400 }}
        >
          <TradingPanel />
        </motion.div>

        {/* Right: Positions + Terminal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <PositionsPanel />
          <TerminalLog />
        </motion.div>
      </div>
    </div>
  );
}