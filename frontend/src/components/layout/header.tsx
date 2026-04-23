"use client";

import { Bell, Zap, Settings, LogOut } from "lucide-react";
import { BotSelector } from "@/components/dashboard/bot-selector";
import { useAppStore } from "@/store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function Header() {
  const router = useRouter();
  const { clearAuth } = useAppStore();

  const handleLogout = () => {
    clearAuth();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <header
      className="glass-card"
      style={{
        margin: 0,
        borderRadius: 0,
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(11, 11, 15, 0.95)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div style={{ padding: "0.75rem 1.5rem", maxWidth: 1600, margin: "0 auto" }} className="flex items-center justify-between gap-4">
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
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
            <Zap size={18} style={{ color: "#6366f1" }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#fafafa" }}>
            Poly<span style={{ color: "#6366f1" }}>Trade</span>
          </span>
        </div>

        {/* Bot Selector - Centered */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <BotSelector />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button
            type="button"
            className="glass-card"
            style={{
              padding: "0.5rem",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.03)",
            }}
          >
            <Bell size={18} style={{ color: "#a1a1aa" }} />
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="glass-card"
            style={{
              padding: "0.5rem",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.03)",
            }}
          >
            <Settings size={18} style={{ color: "#a1a1aa" }} />
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="glass-card"
            style={{
              padding: "0.5rem",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.03)",
            }}
          >
            <LogOut size={18} style={{ color: "#a1a1aa" }} />
          </button>
        </div>
      </div>
    </header>
  );
}