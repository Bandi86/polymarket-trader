import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import type {
  Bot,
  CreateBotRequest,
  LoginResponse,
  Market,
  Order,
  PlaceOrderRequest,
  Position,
  Settings,
  SystemStatus,
} from "@/types";

// Auth
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) =>
      apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      localStorage.setItem("token", data.token);
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: () => apiFetch<{ id: number; email: string; username: string }>("/auth/me"),
    enabled: !!localStorage.getItem("token"),
  });
}

// Bots
export function useBots() {
  return useQuery({
    queryKey: ["bots"],
    queryFn: () => apiFetch<Bot[]>("/bots"),
    refetchInterval: 5000,
  });
}

export function useBot(id: number) {
  return useQuery({
    queryKey: ["bots", id],
    queryFn: () => apiFetch<Bot>(`/bots/${id}`),
    enabled: id > 0,
  });
}

export function useCreateBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBotRequest) =>
      apiFetch<Bot>("/bots", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
  });
}

export function useStartBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => apiFetch<Bot>(`/bots/${id}/start`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
  });
}

export function useStopBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => apiFetch<Bot>(`/bots/${id}/stop`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
  });
}

export function useRunAllBots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => apiFetch<void>("/bots/run-all", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
  });
}

export function useStopAllBots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => apiFetch<void>("/bots/stop-all", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
  });
}

// Positions
export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: () => apiFetch<Position[]>("/positions"),
    refetchInterval: 3000,
  });
}

export function useLivePositions() {
  return useQuery({
    queryKey: ["positions", "live"],
    queryFn: () => apiFetch<Position[]>("/positions/live"),
    refetchInterval: 5000,
  });
}

// Orders
export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => apiFetch<Order[]>("/orders"),
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PlaceOrderRequest) =>
      apiFetch<Order>("/orders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) =>
      apiFetch<void>("/orders/cancel", {
        method: "POST",
        body: JSON.stringify({ order_id: orderId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

// Quick Trade for UP/DOWN buttons
export function useQuickTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { side: "UP" | "DOWN"; amount: number }) =>
      apiFetch<{
        success: boolean;
        message: string;
        order_id?: string;
        btc_price?: number;
        beat_price?: number;
        error_code?: string;
      }>("/orders/quick", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
    },
  });
}

// Markets
export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: () => apiFetch<Market[]>("/market/list"),
  });
}

export function useActiveMarkets() {
  return useQuery({
    queryKey: ["markets", "active"],
    queryFn: () => apiFetch<Market[]>("/market/active"),
    refetchInterval: 10000,
  });
}

export function useBtcPrice() {
  return useQuery({
    queryKey: ["btc-price"],
    queryFn: () => apiFetch<{ price: number }>("/market/btc-price"),
    refetchInterval: 1000,
  });
}

// Settings
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Settings>("/settings"),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Settings>) =>
      apiFetch<Settings>("/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useValidateCredentials() {
  return useMutation({
    mutationFn: async (data: {
      polymarket_api_key?: string;
      polymarket_api_secret?: string;
      polymarket_api_passphrase?: string;
    }) =>
      apiFetch<{ valid: boolean; balance?: number }>("/settings/validate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

// System
export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: () => apiFetch<SystemStatus>("/system/status"),
    refetchInterval: 5000,
  });
}

export function useLogs() {
  return useQuery({
    queryKey: ["logs"],
    queryFn: () => apiFetch<{ logs: unknown[] }>("/system/logs"),
  });
}
