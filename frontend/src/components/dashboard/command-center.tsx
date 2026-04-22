"use client";

import { motion } from "framer-motion";
import { BeatPriceIndicator } from "@/components/dashboard/beat-price-indicator";
import { TradingPanel } from "@/components/dashboard/trading-panel";
import { BotStatusGrid } from "@/components/dashboard/bot-status-grid";
import { TerminalLog } from "@/components/dashboard/terminal-log";
import { PositionsPanel } from "@/components/dashboard/positions-panel";

export function CommandCenter() {
  return (
    <div className="trading-grid h-full">
      {/* Left Column - Beat Price & Bot Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Beat Price Indicator */}
        <BeatPriceIndicator />

        {/* Bot Status Grid */}
        <BotStatusGrid />
      </motion.div>

      {/* Center Column - Trading Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        {/* Trading Panel with TradingView placeholder */}
        <TradingPanel />

        {/* Terminal Log */}
        <TerminalLog />
      </motion.div>

      {/* Right Column - Positions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <PositionsPanel />
      </motion.div>
    </div>
  );
}