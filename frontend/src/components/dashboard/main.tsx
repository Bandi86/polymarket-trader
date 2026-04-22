"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandCenter } from "@/components/dashboard/command-center";
import { AmbientGlow } from "@/components/ui/ambient-glow";
import { useAppStore } from "@/store";
import { useSSE, useBots, useBtcPrice, usePositions } from "@/hooks";

export function Dashboard() {
  const router = useRouter();
  const { token, setBots, setBtcPrice, setPositions } = useAppStore();

  // SSE connection for real-time data
  useSSE();

  // Fetch initial data via API
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

  // Auth check - redirect to login if not authenticated
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!token && !storedToken) {
      router.push("/login");
    }
  }, [token, router]);

  const { sidebarCollapsed } = useAppStore();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow effects */}
      <AmbientGlow color="green" position="top-left" />
      <AmbientGlow color="blue" position="bottom-right" />
      <AmbientGlow color="primary" position="center" />

      {/* Layout */}
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <CommandCenter />
          </main>
        </div>
      </div>
    </div>
  );
}