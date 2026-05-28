"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPortfolio, fetchHistory, fetchTrades, fetchAnalytics } from "@/lib/api";
import type { Portfolio, HistoryPoint, TradeRecord, PortfolioAnalytics } from "@/lib/types";

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [p, h, t, a] = await Promise.all([
        fetchPortfolio(),
        fetchHistory(),
        fetchTrades(),
        fetchAnalytics(),
      ]);
      setPortfolio(p);
      setHistory(h);
      setTrades(t);
      setAnalytics(a);
    } catch (e) {
      console.error("Portfolio fetch failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { portfolio, history, trades, analytics, loading, refresh };
}
