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

  prices.forEach((update) => {
    if (update.direction === "up") gainers++;
    else if (update.direction === "down") losers++;
    else flat++;
  });

  const total = prices.size || 1;
  const moving = gainers + losers;
  const volatility: "HIGH" | "MED" | "LOW" =
    moving / total > 0.7 ? "HIGH"
    : moving / total > 0.4 ? "MED"
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
