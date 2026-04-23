"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/store";

export function BotSelector() {
  const { bots, selectedBotId, setSelectedBot } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  const selectedBot = bots.find((b) => b.id === selectedBotId);

  return (
    <div style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="glass-card"
        style={{
          padding: "0.5rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(99, 102, 241, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bot size={16} style={{ color: "#6366f1" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{ fontWeight: 500, fontSize: 14, color: "#fafafa" }}>
            {selectedBot?.name ?? "Botok"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className={`status-dot status-dot-${selectedBot?.status ?? "stopped"}`} />
            <span style={{ fontSize: 12, color: "#71717a" }}>
              {selectedBot?.status ?? "Válassz botot"}
            </span>
          </div>
        </div>
        <ChevronDown
          size={16}
          style={{
            color: "#a1a1aa",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 8,
              width: 256,
              zIndex: 50,
              padding: 8,
            }}
          >
            {bots.length === 0 ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "#71717a" }}>
                <span style={{ fontSize: 14 }}>Nincs elérhető bot</span>
              </div>
            ) : (
              bots.map((bot) => (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => {
                    setSelectedBot(bot.id);
                    setIsOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem",
                    borderRadius: 8,
                    background:
                      bot.id === selectedBotId ? "rgba(99, 102, 241, 0.15)" : "transparent",
                    border: bot.id === selectedBotId ? "1px solid rgba(99, 102, 241, 0.3)" : "none",
                    cursor: "pointer",
                    marginBottom: 4,
                  }}
                >
                  <div className={`status-dot status-dot-${bot.status}`} />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ fontWeight: 500, fontSize: 14, color: "#fafafa" }}>
                      {bot.name}
                    </span>
                    <span style={{ fontSize: 12, color: "#71717a" }}>{bot.strategy}</span>
                  </div>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
