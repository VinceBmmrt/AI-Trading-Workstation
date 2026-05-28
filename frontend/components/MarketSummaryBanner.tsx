"use client";

import { useEffect, useState } from "react";
import { fetchMarketSummary } from "@/lib/api";

export default function MarketSummaryBanner() {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchMarketSummary();
        setSummary(data.summary);
      } catch {
        setSummary("Market summary unavailable.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border bg-surface shrink-0 min-w-0">
      <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-accent shrink-0">
        AI Summary
      </span>
      {loading ? (
        <div className="flex-1 h-2.5 rounded bg-surface-2 animate-pulse" />
      ) : (
        <span className="flex-1 text-[10px] font-mono text-text-dim truncate whitespace-nowrap overflow-hidden">
          {summary}
        </span>
      )}
    </div>
  );
}
