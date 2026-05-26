"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPortfolio, fetchHistory } from "@/lib/api";
import type { Portfolio, HistoryPoint } from "@/lib/types";

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([fetchPortfolio(), fetchHistory()]);
      setPortfolio(p);
      setHistory(h);
    } catch (e) {
      console.error("Portfolio fetch failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 10s to keep in sync
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { portfolio, history, loading, refresh };
}
