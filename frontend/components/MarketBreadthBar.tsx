"use client";

import type { PriceUpdate } from "@/lib/types";

interface Props {
  prices: Map<string, PriceUpdate>;
}

/** Compute market breadth from live price updates */
function computeBreadth(prices: Map<string, PriceUpdate>) {
  let gainers = 0;
  let losers = 0;
  let flat = 0;
  let bigMoves = 0; // >1% change

  prices.forEach((update) => {
    const pct = Math.abs(update.change_percent);
    if (update.change_percent > 0.1) gainers++;
    else if (update.change_percent < -0.1) losers++;
    else flat++;
    if (pct > 1) bigMoves++;
  });

  const total = prices.size;
  const volatility: "HIGH" | "MED" | "LOW" =
    total === 0 ? "LOW"
    : bigMoves / total > 0.4 ? "HIGH"
    : bigMoves / total > 0.15 ? "MED"
    : "LOW";

  return { gainers, losers, flat, volatility };
}

const VOL_COLOR: Record<string, string> = {
  HIGH: "text-down",
  MED: "text-accent",
  LOW: "text-text-dim",
};

export default function MarketBreadthBar({ prices }: Props) {
  if (prices.size === 0) return null;

  const { gainers, losers, flat, volatility } = computeBreadth(prices);

  return (
    <div className="flex items-center gap-4 px-5 h-6 bg-surface border-b border-border shrink-0 overflow-x-auto">
      <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest shrink-0">
        Market
      </span>
      <div className="flex items-center gap-4 text-[10px] font-mono tabular-nums shrink-0">
        <span className="text-up">
          ▲ <span className="font-semibold">{gainers}</span> GAIN
        </span>
        <span className="text-down">
          ▼ <span className="font-semibold">{losers}</span> LOSS
        </span>
        <span className="text-text-dim">
          → <span className="font-semibold">{flat}</span> FLAT
        </span>
        <span className={`${VOL_COLOR[volatility]} tracking-wider`}>
          VOL: <span className="font-semibold">{volatility}</span>
        </span>
      </div>
    </div>
  );
}
