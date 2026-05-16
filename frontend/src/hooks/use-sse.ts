"use client";

import { useCallback, useEffect, useRef } from "react";
import { dispatchNotification } from "@/hooks/use-notifications";
import { createSSEConnection, useAppStore } from "@/store";

// Module-level singleton to prevent multiple SSE connections
let sharedEventSource: EventSource | null = null;
let listenerCount = 0;

export function useSSE() {
  const prevEventStartTimeRef = useRef<number>(0);
  const lastConfirmedStartPriceRef = useRef<number>(0);

  // Store ref for accessing state inside callbacks (avoids stale closures)
  const storeRef = useRef(useAppStore.getState);
  storeRef.current = useAppStore.getState;

  const setupConnection = useCallback(() => {
    // Singleton: reuse existing connection
    if (sharedEventSource && sharedEventSource.readyState !== EventSource.CLOSED) {
      listenerCount++;
      return sharedEventSource;
    }

    // Grab fresh store functions at connection time
    const _store = storeRef.current();

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
      const state = useAppStore.getState();
      const health = state.sseHealth;
      state.setSSEHealth({
        connected: true,
        connectedSince: health.connected ? health.connectedSince : Date.now(),
        reconnectCount: health.connected ? health.reconnectCount + 1 : 0,
        messageCount: health.messageCount,
        errorCount: health.errorCount,
        lastMessageAt: health.lastMessageAt,
        status: health.status,
      });
    });

    eventSource.addEventListener("market", (e: MessageEvent) => {
      try {
        // Measure SSE event processing latency: from event arrival to state update
        const t0 = performance.now();
        const data = JSON.parse(e.data);
        const store = storeRef.current();

        // Check if start_price is explicitly present in the event (backend sends it only when captured)
        const hasStartPrice = data.start_price !== undefined || data.price_to_beat !== undefined;
        const newStartPrice = data.start_price || data.price_to_beat || 0;
        const eventStartTime = data.event_start_time || 0;

        // Detect new market start (event_start_time changed)
        if (
          eventStartTime > 0 &&
          prevEventStartTimeRef.current > 0 &&
          eventStartTime !== prevEventStartTimeRef.current
        ) {
          store.addMarketResult({
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
        }

        // Batch all market data updates into single set() call
        const updates: Record<string, number | string> = {};
        if (data.btc_price !== undefined) updates.btcPrice = data.btc_price;
        // Only include startPrice and priceDelta when start_price has been captured (hasStartPrice)
        // This prevents flickering during market transitions
        if (hasStartPrice && newStartPrice > 0) {
          updates.startPrice = newStartPrice;
          updates.priceDelta = data.price_delta ?? data.btc_price - newStartPrice;
        } else if (hasStartPrice && lastConfirmedStartPriceRef.current > 0) {
          // Only show delta if we have a confirmed start price AND start_price was in the event
          updates.priceDelta = data.btc_price - lastConfirmedStartPriceRef.current;
        }
        if (hasStartPrice && (data.price_to_beat || data.beat_price))
          updates.beatPrice = data.price_to_beat || data.beat_price;
        if (data.yes !== undefined) updates.yesPrice = data.yes;
        if (data.no !== undefined) updates.noPrice = data.no;
        if (data.yes_price !== undefined) updates.yesPrice = data.yes_price;
        if (data.no_price !== undefined) updates.noPrice = data.no_price;
        if (data.market_question) updates.marketQuestion = data.market_question;
        if (data.time_remaining !== undefined) updates.timeRemaining = data.time_remaining;
        if (data.volume !== undefined) updates.volume = data.volume;
        if (data.api_latency !== undefined) updates.apiLatency = data.api_latency;

        if (Object.keys(updates).length > 0) {
          store.setMarketData(updates);
        }

        // Measure SSE event processing latency (event arrival → state update scheduled)
        // This captures JSON parse + data processing + Zustand set() call overhead
        // For the full end-to-end pipeline (including network), this represents the
        // frontend-side contribution. Network + backend processing add ~10-30ms on localhost.
        const t1 = performance.now();
        const latencyMs = t1 - t0;
        if (latencyMs >= 0.01) {
          store.setLatency(latencyMs);
        }
        store.setSSEHealth({
          messageCount: useAppStore.getState().sseHealth.messageCount + 1,
          lastMessageAt: Date.now(),
        });
      } catch (err) {
        console.error("Failed to parse market event:", err);
      }
    });

    eventSource.addEventListener("status", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const store = storeRef.current();
        const current = store.systemStatus;
        store.setSystemStatus({
          bots_running: data.running_bots,
          bots_total: current?.bots_total ?? data.running_bots,
          total_pnl: data.total_pnl,
          active_positions: current?.active_positions ?? 0,
          binance_connected: current?.binance_connected ?? true,
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
        const store = storeRef.current();

        switch (data.type) {
          case "session_started": {
            store.addLog({
              bot_id: data.bot_id,
              bot_name: data.bot_name || `Bot ${data.bot_id}`,
              message: `Session started (ID: ${data.session_id})`,
              timestamp: Date.now(),
              level: "success",
            });
            store.updateBot(data.bot_id, { status: "running" });
            dispatchNotification(
              "info",
              `${data.bot_name || `Bot ${data.bot_id}`} started`,
              `Session ${data.session_id} began`,
              { sessionId: data.session_id },
              data.bot_id,
              data.bot_name
            );
            break;
          }

          case "session_ended": {
            store.addLog({
              bot_id: data.bot_id,
              bot_name: `Bot ${data.bot_id}`,
              message: `Session ended. PnL: $${data.total_pnl.toFixed(2)} | ${data.session_trades} trades (${data.session_wins}W/${data.session_losses}L) | DD: ${((data.max_drawdown || 0) * 100).toFixed(1)}%`,
              timestamp: Date.now(),
              level: "info",
            });
            store.updateBot(data.bot_id, {
              status: "stopped",
              stats: {
                trades: data.session_trades || 0,
                pnl: data.total_pnl || 0,
                wins: data.session_wins || 0,
                losses: data.session_losses || 0,
                winRate:
                  data.session_trades > 0 ? (data.session_wins / data.session_trades) * 100 : 0,
              },
            });
            dispatchNotification(
              "session_complete",
              `${data.bot_name || `Bot ${data.bot_id}`} session ended`,
              `Final: $${typeof data.final_balance === "number" ? data.final_balance.toFixed(2) : "—"} | ${data.session_trades} trades | ${((data.max_drawdown || 0) * 100).toFixed(1)}% DD`,
              {
                totalPnl: data.total_pnl,
                finalBalance: data.final_balance,
                sessionTrades: data.session_trades,
                sessionWins: data.session_wins,
                sessionLosses: data.session_losses,
                maxDrawdown: data.max_drawdown,
              },
              data.bot_id,
              data.bot_name
            );
            break;
          }

          case "trade_decision": {
            const outcomeText = data.outcome === "YES" ? "UP" : "DOWN";
            const confidencePct = (data.confidence * 100).toFixed(0);
            store.addLog({
              bot_id: data.bot_id,
              bot_name: `Bot ${data.bot_id}`,
              message: `Decision: ${outcomeText} @ $${data.bet_size.toFixed(2)} (confidence: ${confidencePct}%). ${data.reason}`,
              timestamp: Date.now(),
              level: data.confidence > 0.7 ? "success" : "info",
            });
            store.addBotActivity(data.bot_id, {
              botId: data.bot_id,
              type: "trade_decision",
              timestamp: Date.now(),
              data: {
                outcome: data.outcome,
                betSize: data.bet_size,
                confidence: data.confidence,
                reason: data.reason,
              },
            });
            dispatchNotification(
              "trade",
              `${data.bot_name || `Bot ${data.bot_id}`} → ${data.outcome}`,
              `$${data.bet_size.toFixed(2)} @ ${confidencePct}% confidence`,
              {
                outcome: data.outcome,
                betSize: data.bet_size,
                confidence: data.confidence,
                reason: data.reason,
                strategy: data.strategy,
              },
              data.bot_id,
              data.bot_name
            );
            break;
          }

          case "order_executed": {
            store.addLog({
              bot_id: data.bot_id,
              bot_name: `Bot ${data.bot_id}`,
              message: `Order placed: ${data.order_id}`,
              timestamp: Date.now(),
              level: "success",
            });
            store.addBotActivity(data.bot_id, {
              botId: data.bot_id,
              type: "order_executed",
              timestamp: Date.now(),
              data: { orderId: data.order_id },
            });
            dispatchNotification(
              "trade",
              `${data.bot_name || `Bot ${data.bot_id}`} order filled`,
              `Order ${data.order_id?.slice(0, 12) || "—"} placed`,
              { orderId: data.order_id },
              data.bot_id,
              data.bot_name
            );
            break;
          }

          case "balance_updated": {
            break;
          }

          case "error": {
            store.addLog({
              bot_id: data.bot_id,
              bot_name: `Bot ${data.bot_id}`,
              message: data.message,
              timestamp: Date.now(),
              level: "error",
            });
            store.updateBot(data.bot_id, { status: "error" });
            store.addBotActivity(data.bot_id, {
              botId: data.bot_id,
              type: "error",
              timestamp: Date.now(),
              data: { message: data.message },
            });
            dispatchNotification(
              "error",
              `${data.bot_name || `Bot ${data.bot_id}`} error`,
              data.message,
              { error: data.message },
              data.bot_id,
              data.bot_name
            );
            break;
          }

          case "market_transition": {
            store.addLog({
              bot_id: 0,
              bot_name: "System",
              message: `Market transition: ${data.new_market_slug}`,
              timestamp: Date.now(),
              level: "info",
            });
            break;
          }

          case "scanning": {
            store.addBotActivity(data.bot_id, {
              botId: data.bot_id,
              type: "scanning",
              timestamp: Date.now(),
              data: { market: data.market_slug },
            });
            break;
          }

          case "evaluating": {
            store.addBotActivity(data.bot_id, {
              botId: data.bot_id,
              type: "evaluating",
              timestamp: Date.now(),
              data: { strategy: data.strategy, confidence: data.confidence },
            });
            break;
          }

          case "position_update": {
            store.addBotActivity(data.bot_id, {
              botId: data.bot_id,
              type: "position_update",
              timestamp: Date.now(),
              data: {
                side: data.side,
                size: data.size,
                price: data.price,
                bot_name: data.bot_name,
                unrealizedPnl: data.unrealized_pnl,
              },
            });
            break;
          }

          case "trade_result": {
            store.addBotActivity(data.bot_id, {
              botId: data.bot_id,
              type: "trade_result",
              timestamp: Date.now(),
              data: { won: data.won, pnl: data.pnl },
            });
            dispatchNotification(
              "settlement",
              `${data.bot_name || `Bot ${data.bot_id}`} ${data.won ? "won" : "lost"} $${data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(2)}`,
              data.won ? "Trade settled as WIN" : "Trade settled as LOSS",
              { won: data.won, pnl: data.pnl },
              data.bot_id,
              data.bot_name
            );
            break;
          }
        }
      } catch (err) {
        console.error("Failed to parse bot event:", err);
      }
    });

    eventSource.onerror = () => {
      // SSE onerror fires during normal reconnection cycles - this is expected behavior
      // Only log as warning, don't increment errorCount since connection recovers automatically
      console.warn("SSE connection dropped, reconnecting...");
      // Update reconnect count but NOT error count - reconnections are normal for SSE
      const state = useAppStore.getState();
      const health = state.sseHealth;
      state.setSSEHealth({
        connected: false, // Mark as disconnected during reconnection
        reconnectCount: health.reconnectCount + 1,
        messageCount: health.messageCount,
        errorCount: health.errorCount, // Don't increment - reconnects are normal
        lastMessageAt: health.lastMessageAt,
        connectedSince: health.connectedSince,
        status: "connecting", // Mark as connecting during reconnection
      });
    };

    sharedEventSource = eventSource;
    listenerCount = 1;
    return eventSource;
  }, []); // Empty deps - setupConnection is stable and only created once

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
