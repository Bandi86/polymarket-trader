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
    addLog,
    updateBot,
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
        if (newStartPrice > 0) {
          lastConfirmedStartPriceRef.current = newStartPrice;
          setStartPrice(newStartPrice);
          setPriceDelta(data.price_delta || 0);
        } else if (lastConfirmedStartPriceRef.current > 0) {
          setPriceDelta(data.btc_price - lastConfirmedStartPriceRef.current);
        }

        setBtcPrice(data.btc_price);
        setBeatPrice(data.price_to_beat || data.beat_price);
        if (data.yes !== undefined) setYesPrice(data.yes);
        if (data.no !== undefined) setNoPrice(data.no);
        if (data.yes_price !== undefined) setYesPrice(data.yes_price);
        if (data.no_price !== undefined) setNoPrice(data.no_price);
        if (data.market_question) setMarketQuestion(data.market_question);
        if (data.time_remaining !== undefined) setTimeRemaining(data.time_remaining);
        if (data.volume !== undefined) setVolume(data.volume);
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

    // Handle bot lifecycle and trading events
    eventSource.addEventListener("bot", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);

        switch (data.type) {
          case "session_started": {
            addLog({
              bot_id: data.bot_id,
              bot_name: data.bot_name || `Bot ${data.bot_id}`,
              message: `Session started (ID: ${data.session_id})`,
              timestamp: Date.now(),
              level: "success",
            });
            updateBot(data.bot_id, { status: "running" });
            break;
          }

          case "session_ended": {
            addLog({
              bot_id: data.bot_id,
              bot_name: `Bot ${data.bot_id}`,
              message: `Session ended. PnL: $${data.total_pnl.toFixed(2)}`,
              timestamp: Date.now(),
              level: "info",
            });
            updateBot(data.bot_id, { status: "stopped" });
            break;
          }

          case "trade_decision": {
            const outcomeText = data.outcome === "YES" ? "UP" : "DOWN";
            const confidencePct = (data.confidence * 100).toFixed(0);
            addLog({
              bot_id: data.bot_id,
              bot_name: `Bot ${data.bot_id}`,
              message: `Decision: ${outcomeText} @ $${data.bet_size.toFixed(2)} (confidence: ${confidencePct}%). ${data.reason}`,
              timestamp: Date.now(),
              level: data.confidence > 0.7 ? "success" : "info",
            });
            break;
          }

          case "order_executed": {
            addLog({
              bot_id: data.bot_id,
              bot_name: `Bot ${data.bot_id}`,
              message: `Order placed: ${data.order_id}`,
              timestamp: Date.now(),
              level: "success",
            });
            break;
          }

          case "balance_updated": {
            // Portfolio balance updates are fetched via /bots/:id/portfolio API
            break;
          }

          case "error": {
            addLog({
              bot_id: data.bot_id,
              bot_name: `Bot ${data.bot_id}`,
              message: data.message,
              timestamp: Date.now(),
              level: "error",
            });
            updateBot(data.bot_id, { status: "error" });
            break;
          }

          case "market_transition": {
            addLog({
              bot_id: 0,
              bot_name: "System",
              message: `Market transition: ${data.new_market_slug}`,
              timestamp: Date.now(),
              level: "info",
            });
            break;
          }
        }
      } catch (err) {
        console.error("Failed to parse bot event:", err);
      }
    });

    eventSource.onerror = () => {
      console.warn("SSE connection error, reconnecting...");
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
    addLog,
    updateBot,
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
