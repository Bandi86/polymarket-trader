"use client";

import {
  Bot,
  History,
  Home,
  LineChart,
  LogIn,
  LogOut,
  Settings,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NotificationCenter } from "@/components/ui/notification-center";
import { TradingModeToggle } from "@/components/ui/trading-mode-toggle";
import { useSettings, useSSE } from "@/hooks";
import { useAppStore } from "@/store";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/bots", label: "Bots", icon: Bot },
  { href: "/markets", label: "Markets", icon: LineChart },
  { href: "/orders", label: "Orders", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { clearAuth, user, isAuthenticated } = useAppStore();
  const { data: settings } = useSettings();
  const hasCreds = settings?.has_credentials ?? false;

  // SSE connection for real-time data
  useSSE();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogout = () => {
    clearAuth();
    toast.success("Sikeres kijelentkezés");
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-zinc-400">Betöltés...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-zinc-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15">
              <Zap className="h-5 w-5 text-indigo-400" />
            </div>
            <span className="text-lg font-bold text-zinc-100">PolyTrade</span>
          </Link>

          {/* Center: Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Status & Actions */}
          <div className="flex items-center gap-3">
            {/* Trading Mode */}
            <div className="hidden sm:block">
              <TradingModeToggle />
            </div>

            {/* User Status */}
            {isAuthenticated && user ? (
              <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 md:flex">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <User className="h-3 w-3 text-green-400" />
                <span className="text-xs font-semibold text-green-400">@{user.username}</span>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/70 px-3 py-1.5 transition-colors hover:bg-zinc-800/80"
              >
                <LogIn className="h-3 w-3 text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-500">Bejelentkezés</span>
              </Link>
            )}

            {/* Wallet Status */}
            {isAuthenticated &&
              (hasCreds ? (
                <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 md:flex">
                  <Wallet className="h-3 w-3 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">Connected</span>
                </div>
              ) : (
                <Link
                  href="/settings"
                  className="hidden items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 md:flex"
                >
                  <Wallet className="h-3 w-3 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400">Connect</span>
                </Link>
              ))}

            {/* Notifications */}
            <NotificationCenter />

            {/* Mobile Menu */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/8 bg-white/3"
                onClick={() => {
                  const menu = document.getElementById("mobile-menu");
                  if (menu) menu.classList.toggle("hidden");
                }}
              >
                <span className="text-zinc-400">☰</span>
              </button>
            </div>

            {/* Logout */}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/8 bg-white/3 transition-colors hover:bg-white/5"
              >
                <LogOut className="h-4 w-4 text-zinc-400" />
              </button>
            ) : (
              <Link
                href="/login"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/8 bg-white/3 transition-colors hover:bg-white/5"
              >
                <LogIn className="h-4 w-4 text-zinc-400" />
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <div id="mobile-menu" className="hidden border-t border-white/8 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-indigo-500/15 text-indigo-400"
                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}
