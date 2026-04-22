"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore, createSSEConnection } from "@/store";
import type { SSEEvent, MarketUpdateEvent, BotLogEvent, Position, SystemStatus, Bot } from "@/types";

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const {
    setBtcPrice,
    setBeatPrice,
    setTimeRemaining,
    setCurrentMarket,
    addLog,
    updateBot,
    setPositions,
    setSystemStatus,
  } = useAppStore();

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = createSSEConnection((event: MessageEvent) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        switch (data.type) {
          case "connected":
            console.log("SSE connected");
            break;

          case "market": {
            const marketData = data.data as MarketUpdateEvent;
            setBtcPrice(marketData.btc_price);
            setBeatPrice(marketData.beat_price);
            if (marketData.current_market) {
              setCurrentMarket(marketData.current_market);
            }
            if (marketData.time_remaining) {
              setTimeRemaining(marketData.time_remaining);
            }
            break;
          }

          case "bot_log": {
            const logData = data.data as BotLogEvent;
            addLog(logData);
            break;
          }

          case "bot": {
            const botData = data.data as { id: number; updates: Partial<Bot> };
            if (botData.id && botData.updates) {
              updateBot(botData.id, botData.updates);
            }
            break;
          }

          case "position": {
            const positionData = data.data as { positions: Position[] };
            if (positionData.positions) {
              setPositions(positionData.positions);
            }
            break;
          }

          case "status": {
            const statusData = data.data as { status: SystemStatus };
            if (statusData.status) {
              setSystemStatus(statusData.status);
            }
            break;
          }
        }
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    });

    eventSourceRef.current = eventSource;
  }, [
    setBtcPrice,
    setBeatPrice,
    setTimeRemaining,
    setCurrentMarket,
    addLog,
    updateBot,
    setPositions,
    setSystemStatus,
  ]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connect, disconnect };
}