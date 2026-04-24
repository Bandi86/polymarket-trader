"use client";

import { useCallback, useEffect, useRef } from "react";
import { createSSEConnection, useAppStore } from "@/store";

// Module-level singleton to prevent multiple SSE connections
let sharedEventSource: EventSource | null = null;
let listenerCount = 0;

export function useSSE() {
  const prevEventStartTimeRef = useRef<number>(0);
  const lastConfirmedStartPriceRef = useRef<number>(0);

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

  const setupConnection = useCallback(() => {
    // Singleton: reuse existing connection
    if (sharedEventSource && sharedEventSource.readyState !== EventSource.CLOSED) {
      listenerCount++;
      return sharedEventSource;
    }

    // Create new connection
    const eventSource = createSSEConnection((event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          console.log("SSE connected");
        }
      } catch {
        // Named events come through onmessage with event data
      }
    });

    eventSource.addEventListener("connected", () => {
      console.log("SSE connected event received");
    });

    eventSource.addEventListener("market", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const newStartPrice = data.start_price || data.price_to_beat || 0;
        const eventStartTime = data.event_start_time || 0;

        // Detect new market start (event_start_time changed)
        if (
          eventStartTime > 0 &&
          prevEventStartTimeRef.current > 0 &&
          eventStartTime !== prevEventStartTimeRef.current
        ) {
          // Previous market just ended - save result
          addMarketResult({
            endTime: Date.now(),
            targetPrice: lastConfirmedStartPriceRef.current,
            finalPrice: data.btc_price,
            delta: data.btc_price - lastConfirmedStartPriceRef.current,
            duration: 300,
          });
          // Keep last confirmed price to beat until new valid one arrives (avoid flickering)
          // Do NOT reset lastConfirmedStartPriceRef - maintain last known good value
        }

        // Track event start time
        if (eventStartTime > 0) {
          if (
            prevEventStartTimeRef.current === 0 ||
            eventStartTime !== prevEventStartTimeRef.current
          ) {
            prevEventStartTimeRef.current = eventStartTime;
          }
        }

        // Only update start price if we have a valid new value
        // This prevents flickering when new market starts but start_price is still 0
        if (newStartPrice > 0) {
          lastConfirmedStartPriceRef.current = newStartPrice;
          setStartPrice(newStartPrice);
          setPriceDelta(data.price_delta || 0);
        } else if (lastConfirmedStartPriceRef.current > 0) {
          // No new start price yet, but we have a confirmed one - use it for delta calculation
          setPriceDelta(data.btc_price - lastConfirmedStartPriceRef.current);
        }

        setBtcPrice(data.btc_price);
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
      // SSE auto-reconnects; keep last known prices until fresh data arrives
    };

    sharedEventSource = eventSource;
    listenerCount = 1;
    return eventSource;
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
    listenerCount--;
    if (listenerCount <= 0 && sharedEventSource) {
      sharedEventSource.close();
      sharedEventSource = null;
      listenerCount = 0;
    }
  }, []);

  useEffect(() => {
    setupConnection();
    return () => disconnect();
  }, [setupConnection, disconnect]);

  return {
    connect: setupConnection,
    disconnect,
  };
}
