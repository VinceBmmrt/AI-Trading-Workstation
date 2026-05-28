"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PriceUpdate, ConnectionStatus } from "@/lib/types";

const HISTORY_LENGTH = 100;
const RECONNECT_DELAY = 2000;

export interface MarketDataState {
  prices: Map<string, PriceUpdate>;
  history: Map<string, number[]>;
  volumeHistory: Map<string, number[]>;
  flashing: Map<string, "up" | "down">;
  status: ConnectionStatus;
}

export function useMarketData() {
  const [state, setState] = useState<MarketDataState>({
    prices: new Map(),
    history: new Map(),
    volumeHistory: new Map(),
    flashing: new Map(),
    status: "disconnected",
  });

  const esRef = useRef<EventSource | null>(null);
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlash = useCallback((ticker: string) => {
    setState((prev) => {
      const flashing = new Map(prev.flashing);
      flashing.delete(ticker);
      return { ...prev, flashing };
    });
  }, []);

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();

    const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
    const es = new EventSource(`${base}/api/stream/prices`);
    esRef.current = es;

    es.onopen = () => {
      setState((prev) => ({ ...prev, status: "connected" }));
    };

    es.onmessage = (event) => {
      const data: Record<string, PriceUpdate> = JSON.parse(event.data);

      setState((prev) => {
        const prices = new Map(prev.prices);
        const history = new Map(prev.history);
        const volumeHistory = new Map(prev.volumeHistory);
        const flashing = new Map(prev.flashing);

        for (const [ticker, update] of Object.entries(data)) {
          const prev_update = prices.get(ticker);
          prices.set(ticker, update);

          // Update sparkline history
          const hist = history.get(ticker) ?? [];
          const next = [...hist, update.price];
          history.set(ticker, next.length > HISTORY_LENGTH ? next.slice(-HISTORY_LENGTH) : next);

          // Simulated volume from price move magnitude
          const vol = Math.round(Math.abs(update.change_percent) * 500_000 * (0.6 + Math.random() * 0.8));
          const vols = volumeHistory.get(ticker) ?? [];
          const nextVols = [...vols, vol];
          volumeHistory.set(ticker, nextVols.length > HISTORY_LENGTH ? nextVols.slice(-HISTORY_LENGTH) : nextVols);

          // Flash on actual price change
          if (!prev_update || prev_update.price !== update.price) {
            const dir = update.direction === "up" || update.direction === "down"
              ? update.direction
              : prev_update && update.price > prev_update.price ? "up" : "down";

            if (dir === "up" || dir === "down") {
              flashing.set(ticker, dir);

              // Clear flash after 500ms
              const existing = flashTimers.current.get(ticker);
              if (existing) clearTimeout(existing);
              const t = setTimeout(() => clearFlash(ticker), 500);
              flashTimers.current.set(ticker, t);
            }
          }
        }

        return { ...prev, prices, history, volumeHistory, flashing };
      });
    };

    es.onerror = () => {
      es.close();
      setState((prev) => ({ ...prev, status: "reconnecting" }));
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };
  }, [clearFlash]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      flashTimers.current.forEach(clearTimeout);
    };
  }, [connect]);

  return state;
}
