import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Bot, Market, Position, BotLogEvent, SystemStatus } from "@/types";

interface AppState {
  // Auth
  token: string | null;
  user: { id: number; email: string; username: string } | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: { id: number; email: string; username: string }) => void;
  clearAuth: () => void;

  // Bots
  bots: Bot[];
  selectedBotId: number | null;
  setBots: (bots: Bot[]) => void;
  setSelectedBot: (id: number | null) => void;
  updateBot: (id: number, updates: Partial<Bot>) => void;

  // Market Data
  btcPrice: number;
  startPrice: number; // BTC price at market start time (price to beat)
  priceDelta: number; // Current - Start price
  beatPrice: number;
  yesPrice: number;
  noPrice: number;
  marketQuestion: string;
  currentMarket: Market | null;
  timeRemaining: number;
  setBtcPrice: (price: number) => void;
  setStartPrice: (price: number) => void;
  setPriceDelta: (delta: number) => void;
  setBeatPrice: (price: number) => void;
  setYesPrice: (price: number) => void;
  setNoPrice: (price: number) => void;
  setMarketQuestion: (question: string) => void;
  setCurrentMarket: (market: Market | null) => void;
  setTimeRemaining: (seconds: number) => void;

  // Positions
  positions: Position[];
  setPositions: (positions: Position[]) => void;

  // Logs
  logs: BotLogEvent[];
  addLog: (log: BotLogEvent) => void;
  clearLogs: () => void;

  // System Status
  systemStatus: SystemStatus | null;
  setSystemStatus: (status: SystemStatus) => void;

  // UI
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  emergencyStopActive: boolean;
  setEmergencyStop: (active: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("token", token);
        }
        set({ token, user, isAuthenticated: true });
      },
      clearAuth: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
        }
        set({ token: null, user: null, isAuthenticated: false });
      },

      // Bots
      bots: [],
      selectedBotId: null,
      setBots: (bots) => set({ bots }),
      setSelectedBot: (id) => set({ selectedBotId: id }),
      updateBot: (id, updates) =>
        set((state) => ({
          bots: state.bots.map((bot) =>
            bot.id === id ? { ...bot, ...updates } : bot
          ),
        })),

      // Market Data
      btcPrice: 0,
      startPrice: 0,
      priceDelta: 0,
      beatPrice: 0,
      yesPrice: 0.5,
      noPrice: 0.5,
      marketQuestion: "",
      currentMarket: null,
      timeRemaining: 0,
      setBtcPrice: (price) => set({ btcPrice: price }),
      setStartPrice: (price) => set({ startPrice: price }),
      setPriceDelta: (delta) => set({ priceDelta: delta }),
      setBeatPrice: (price) => set({ beatPrice: price }),
      setYesPrice: (price) => set({ yesPrice: price }),
      setNoPrice: (price) => set({ noPrice: price }),
      setMarketQuestion: (question) => set({ marketQuestion: question }),
      setCurrentMarket: (market) => set({ currentMarket: market }),
      setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),

      // Positions
      positions: [],
      setPositions: (positions) => set({ positions }),

      // Logs
      logs: [],
      addLog: (log) =>
        set((state) => ({
          logs: [...state.logs.slice(-100), log], // Keep last 100 logs
        })),
      clearLogs: () => set({ logs: [] }),

      // System Status
      systemStatus: null,
      setSystemStatus: (status) => set({ systemStatus: status }),

      // UI
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      emergencyStopActive: false,
      setEmergencyStop: (active) => set({ emergencyStopActive: active }),
    }),
    {
      name: "polytrade-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// SSE Connection Hook Helper
export const createSSEConnection = (
  onMessage: (event: MessageEvent) => void
): EventSource => {
  const token = localStorage.getItem("token");

  // In development, frontend is on port 3000, backend on 3001
  // SSE needs to connect directly to backend
  const isDev = typeof window !== "undefined" && window.location.port === "3000";
  const baseUrl = isDev ? "http://localhost:3001" : window.location.origin;

  const url = new URL(`${baseUrl}/api/events`);
  if (token) {
    url.searchParams.set("token", token);
  }

  const eventSource = new EventSource(url.toString());

  eventSource.onmessage = onMessage;
  eventSource.onerror = (e) => {
    console.error("SSE connection error:", e);
    // SSE will auto-reconnect, no need to manually reconnect
  };

  return eventSource;
};