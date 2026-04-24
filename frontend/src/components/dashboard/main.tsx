"use client";

import { useEffect } from "react";
import { AuthLanding } from "@/components/dashboard/auth-landing";
import { CommandCenter } from "@/components/dashboard/command-center";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { AmbientGlow } from "@/components/ui/ambient-glow";
import { useBots, useBtcPrice, usePositions, useSSE, useUser } from "@/hooks";
import { useAppStore } from "@/store";

export function Dashboard() {
  const { token, isAuthenticated, user, setAuth, setBots, setBtcPrice, setPositions } =
    useAppStore();
  const { data: userData } = useUser();

  // Sync user data from API to store (fixes missing user state after login)
  useEffect(() => {
    if (userData && (!user || user.username !== userData.username)) {
      // Only update user data, don't overwrite token from localStorage
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (storedToken) {
        setAuth(storedToken, { id: userData.id, email: "", username: userData.username });
      }
    }
  }, [userData, user, setAuth]);

  // SSE connection for real-time data
  useSSE();

  // Fetch initial data via API (only when authenticated)
  const { data: botsData } = useBots();
  const { data: btcData } = useBtcPrice();
  const { data: positionsData } = usePositions();

  // Sync API data to store
  useEffect(() => {
    if (botsData) setBots(botsData);
  }, [botsData, setBots]);

  useEffect(() => {
    if (btcData?.price) setBtcPrice(btcData.price);
  }, [btcData, setBtcPrice]);

  useEffect(() => {
    if (positionsData) setPositions(positionsData);
  }, [positionsData, setPositions]);

  const { sidebarCollapsed } = useAppStore();
  const isAuthed =
    isAuthenticated ||
    !!token ||
    (typeof window !== "undefined" && !!localStorage.getItem("token"));

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow effects */}
      <AmbientGlow color="green" position="top-left" />
      <AmbientGlow color="blue" position="bottom-right" />
      <AmbientGlow color="primary" position="center" />

      {/* Layout */}
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-4 lg:p-6">
              {isAuthed ? <CommandCenter /> : <AuthLanding />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
