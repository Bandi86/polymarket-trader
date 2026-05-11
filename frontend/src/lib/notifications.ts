import { create } from "zustand";

export interface Notification {
  id: string;
  type: "trade" | "settlement" | "session_complete" | "error" | "warning" | "info";
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  botId?: number;
  botName?: string;
  data?: Record<string, unknown>;
}

interface NotificationPreferences {
  enabled: boolean;
  tradeEnabled: boolean;
  settlementEnabled: boolean;
  sessionCompleteEnabled: boolean;
  errorEnabled: boolean;
  soundEnabled: boolean;
}

interface NotificationState {
  notifications: Notification[];
  preferences: NotificationPreferences;
  addNotification: (notif: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  setPreferences: (prefs: Partial<NotificationPreferences>) => void;
  getUnreadCount: () => number;
  getBotStreak: (botName: string) => { consecutive: number; wins: number; losses: number } | null;
}

// Notification helpers — notification store is the source of truth

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  preferences: {
    enabled: true,
    tradeEnabled: true,
    settlementEnabled: true,
    sessionCompleteEnabled: true,
    errorEnabled: true,
    soundEnabled: false,
  },

  addNotification: (notif) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notification: Notification = {
      ...notif,
      id,
      timestamp: Date.now(),
      read: false,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 100),
    }));

    // Auto-dismiss non-error notifications after 60s
    if (notif.type !== "error") {
      setTimeout(() => {
        get().clearNotification(id);
      }, 60_000);
    }
  },

  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),

  setPreferences: (prefs) =>
    set((state) => ({
      preferences: { ...state.preferences, ...prefs },
    })),

  getUnreadCount: () => {
    const { notifications, preferences } = get();
    return notifications.filter((n) => {
      if (!n.read && preferences.enabled) {
        if (n.type === "trade" && !preferences.tradeEnabled) return false;
        if (n.type === "settlement" && !preferences.settlementEnabled) return false;
        if (n.type === "session_complete" && !preferences.sessionCompleteEnabled) return false;
        if (n.type === "error" && !preferences.errorEnabled) return false;
        return true;
      }
      return false;
    }).length;
  },

  getBotStreak: (botName) => {
    const botNotifications = get().notifications.filter(
      (n) => n.botName === botName && (n.type === "trade" || n.type === "settlement")
    );
    if (botNotifications.length === 0) return null;

    // Find most recent settlement to determine current streak direction
    const settlements = botNotifications.filter((n) => n.type === "settlement");
    if (settlements.length === 0) return { consecutive: 0, wins: 0, losses: 0 };

    const latestSettlement = settlements[0];
    const won = latestSettlement.data?.won as boolean;
    let consecutive = 0;
    let wins = 0;
    let losses = 0;

    for (const notif of settlements) {
      if ((notif.data?.won as boolean) === won) {
        consecutive++;
        if (won) wins++;
        else losses++;
      } else {
        break;
      }
    }

    return { consecutive, wins, losses };
  },
}));
