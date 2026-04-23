"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore, createSSEConnection } from "@/store";

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const {
    setBtcPrice,
    setStartPrice,
    setPriceDelta,
    setBeatPrice,
    setYesPrice,
    setNoPrice,
    setMarketQuestion,
    setTimeRemaining,
    setCurrentMarket,
    addLog,
    updateBot,
    setPositions,
    setSystemStatus,
    setBots,
  } = useAppStore();

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Use addEventListener for named SSE events (backend uses event("market"), event("status"))
    const eventSource = createSSEConnection((event: MessageEvent) => {
      // Handle unnamed events (fallback)
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          console.log("SSE connected");
        }
      } catch {
        // Named events come through onmessage with event data
      }
    });

    // Handle named SSE events from backend
    eventSource.addEventListener("connected", () => {
      console.log("SSE connected event received");
    });

    eventSource.addEventListener("market", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setBtcPrice(data.btc_price);
        setStartPrice(data.start_price || data.price_to_beat || 0);
        setPriceDelta(data.price_delta || 0);
        setBeatPrice(data.price_to_beat || data.beat_price);
        if (data.yes !== undefined) {
          setYesPrice(data.yes);
        }
        if (data.no !== undefined) {
          setNoPrice(data.no);
        }
        if (data.yes_price !== undefined) {
          setYesPrice(data.yes_price);
        }
        if (data.no_price !== undefined) {
          setNoPrice(data.no_price);
        }
        if (data.market_question) {
          setMarketQuestion(data.market_question);
        }
        if (data.time_remaining) {
          setTimeRemaining(data.time_remaining);
        }
        console.log("Market update:", data);
      } catch (err) {
        console.error("Failed to parse market event:", err);
      }
    });

    eventSource.addEventListener("status", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSystemStatus({
          bots_running: data.running_bots,
          bots_total: data.running_bots, // TODO: fetch total bots separately
          total_pnl: data.total_pnl,
          active_positions: 0,
          binance_connected: true,
          last_update: Date.now(),
        });
      } catch (err) {
        console.error("Failed to parse status event:", err);
      }
    });

    eventSource.onerror = () => {
      console.error("SSE connection error");
    };

    eventSourceRef.current = eventSource;
  }, [
    setBtcPrice,
    setStartPrice,
    setPriceDelta,
    setBeatPrice,
    setYesPrice,
    setNoPrice,
    setMarketQuestion,
    setTimeRemaining,
    setCurrentMarket,
    addLog,
    updateBot,
    setPositions,
    setSystemStatus,
    setBots,
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