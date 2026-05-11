import { useCallback } from "react";
import { useNotificationStore } from "@/lib/notifications";

// Re-export types
export type { Notification } from "@/lib/notifications";

export function useNotifications() {
  const store = useNotificationStore();

  // Memoized unread count
  const unreadCount = store.getUnreadCount();

  // Mark as read helper
  const markAsRead = useCallback(
    (id: string) => {
      store.markAsRead(id);
    },
    [store]
  );

  // Get notifications with their read state resolved against preferences
  const getFilteredNotifications = useCallback(() => {
    const { notifications, preferences } = store;
    return notifications.filter((n) => {
      if (!preferences.enabled) return false;
      if (n.type === "trade" && !preferences.tradeEnabled) return false;
      if (n.type === "settlement" && !preferences.settlementEnabled) return false;
      if (n.type === "session_complete" && !preferences.sessionCompleteEnabled) return false;
      if (n.type === "error" && !preferences.errorEnabled) return false;
      return true;
    });
  }, [store]);

  return {
    notifications: store.notifications,
    unread: store.notifications.filter((n) => !n.read),
    unreadCount,
    preferences: store.preferences,
    markAllAsRead: store.markAllAsRead,
    clearAll: store.clearAll,
    setPreferences: store.setPreferences,
    getBotStreak: store.getBotStreak,
    getFilteredNotifications,
  };
}

// Helper to dispatch a notification from SSE event handlers
// Call this from useSSE when processing bot events
export function dispatchNotification(
  type: "trade" | "settlement" | "session_complete" | "error" | "warning" | "info",
  title: string,
  message?: string,
  data?: Record<string, unknown>,
  botId?: number,
  botName?: string
) {
  useNotificationStore.getState().addNotification({
    type,
    title,
    message,
    data,
    botId,
    botName,
  });
}
