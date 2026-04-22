"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Bot,
  LineChart,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/store";

const navItems = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/bots", label: "Botok", icon: Bot },
  { href: "/markets", label: "Piacok", icon: LineChart },
  { href: "/orders", label: "Rendelések", icon: History },
  { href: "/settings", label: "Beállítások", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const { toggleSidebar } = useAppStore();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
      }}
      className="flex flex-col h-full relative"
    >
      {/* Logo */}
      <div
        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}
        className="p-4 flex items-center gap-3"
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(99, 102, 241, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap style={{ color: "#6366f1" }} size={20} />
        </div>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: "#fafafa", fontWeight: 700, fontSize: 18 }}
          >
            PolyTrade
          </motion.span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? "nav-item-active" : ""} ${collapsed ? "justify-center" : ""}`}
              style={{
                width: "100%",
                marginBottom: 4,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <Icon size={20} />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ fontWeight: 500 }}
                >
                  {item.label}
                </motion.span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleSidebar}
        style={{
          position: "absolute",
          right: -12,
          top: 80,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "rgba(20, 20, 28, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        {collapsed ? (
          <ChevronRight size={16} style={{ color: "#a1a1aa" }} />
        ) : (
          <ChevronLeft size={16} style={{ color: "#a1a1aa" }} />
        )}
      </button>

      {/* Emergency Stop */}
      {!collapsed && (
        <div
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
          className="p-4"
        >
          <button type="button" className="btn-emergency">
            <Zap size={16} />
            Vészleállítás
          </button>
        </div>
      )}
    </motion.aside>
  );
}