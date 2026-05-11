"use client";

import { useEffect, useState } from "react";
import { AuthLanding } from "@/components/dashboard/auth-landing";
import { CommandCenter } from "@/components/dashboard/command-center";
import { useBtcPrice, useSSE, useUser } from "@/hooks";
import { useAppStore } from "@/store";

export function Dashboard() {
  const { token, isAuthenticated, user, setAuth, clearAuth, setMarketData } = useAppStore();
  const { data: userData } = useUser();
  const { data: btcData } = useBtcPrice();

  // Sync user data from API to store
  useEffect(() => {
    if (userData && (!user || user.username !== userData.username)) {
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (storedToken) {
        setAuth(storedToken, { id: userData.id, email: "", username: userData.username });
      }
    }
  }, [userData, user, setAuth]);

  // Handle user not found (404)
  useEffect(() => {
    if (userData === null && token) {
      clearAuth();
    }
  }, [userData, token, clearAuth]);

  // SSE connection
  useSSE();

  // Sync BTC price to store
  useEffect(() => {
    if (btcData?.price) setMarketData({ btcPrice: btcData.price });
  }, [btcData, setMarketData]);

  // Wait for mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check if authenticated (with localStorage)
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasToken(!!localStorage.getItem("token"));
    }
  }, []);

  const isAuthed = isMounted && (isAuthenticated || hasToken);

  if (!isMounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-zinc-400">Betöltés...</p>
        </div>
      </div>
    );
  }

  return isAuthed ? <CommandCenter /> : <AuthLanding />;
}
