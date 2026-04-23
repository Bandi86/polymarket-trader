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
} from "lucide-react";
import { useAppStore } from "@/store";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bots", label: "Bots", icon: Bot },
  { href: "/markets", label: "Markets", icon: LineChart },
  { href: "/orders", label: "Orders", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
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
      animate={{ width: collapsed ? 64 : 200 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{
        background: "rgba(11, 11, 15, 0.95)",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
      }}
      className="flex flex-col h-full relative"
    >
      {/* Navigation */}
      <nav className="flex-1 p-2" style={{ paddingTop: "1rem" }}>
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
                padding: collapsed ? "0.75rem" : "0.75rem 1rem",
              }}
            >
              <Icon size={20} />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ fontWeight: 500, fontSize: 14 }}
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
          top: 24,
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
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", padding: "0.75rem" }}
        >
          <button type="button" className="btn-emergency" style={{ width: "100%" }}>
            Emergency Stop
          </button>
        </div>
      )}
    </motion.aside>
  );
}