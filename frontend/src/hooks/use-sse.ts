"use client";

import { useCallback, useEffect, useRef } from "react";
import { createSSEConnection, useAppStore } from "@/store";

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const prevEventStartTimeRef = useRef<number>(0);
  const prevStartPriceRef = useRef<number>(0);

  const {
    setBtcPrice,
    setStartPrice,
    setPriceDelta,
    setBeatPrice,
    setYesPrice,
    setNoPrice,
    setMarketQuestion,
    setTimeRemaining,
    setSystemStatus,
    setVolume,
    addMarketResult,
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
        const newStartPrice = data.start_price || data.price_to_beat || 0;
        const eventStartTime = data.event_start_time || 0;

        // Detect new market start (event_start_time changed)
        if (eventStartTime > 0 && prevEventStartTimeRef.current > 0 && eventStartTime !== prevEventStartTimeRef.current) {
          // Previous market just ended - save result
          addMarketResult({
            endTime: Date.now(),
            targetPrice: prevStartPriceRef.current,
            finalPrice: data.btc_price,
            delta: data.btc_price - prevStartPriceRef.current,
            duration: 300,
          });
          // Reset start price ref for new market
          prevStartPriceRef.current = 0;
        }

        // Track event start time for change detection
        if (eventStartTime > 0 && prevEventStartTimeRef.current === 0) {
          prevEventStartTimeRef.current = eventStartTime;
        }

        // Save start price when it becomes available (for market result later)
        if (newStartPrice > 0 && prevStartPriceRef.current === 0) {
          prevStartPriceRef.current = newStartPrice;
        }

        setBtcPrice(data.btc_price);
        setStartPrice(newStartPrice);
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
        if (data.time_remaining !== undefined) {
          setTimeRemaining(data.time_remaining);
        }
        if (data.volume !== undefined) {
          setVolume(data.volume);
        }
      } catch (err) {
        console.error("Failed to parse market event:", err);
      }
    });

    eventSource.addEventListener("status", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSystemStatus({
          bots_running: data.running_bots,
          bots_total: data.running_bots,
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
      console.warn("SSE connection error, reconnecting...");
      // SSE auto-reconnects, but reset refs to avoid stale state
      prevEventStartTimeRef.current = 0;
      prevStartPriceRef.current = 0;
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
    setSystemStatus,
    setVolume,
    addMarketResult,
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
