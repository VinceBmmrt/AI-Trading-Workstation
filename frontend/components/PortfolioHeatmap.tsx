"use client";

import type { Portfolio } from "@/lib/types";

interface Props {
  portfolio: Portfolio | null;
}

export default function PortfolioHeatmap({ portfolio }: Props) {
  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-dim">
        <span className="text-2xl opacity-20">◈</span>
        <span className="text-[10px] font-mono uppercase tracking-widest">No positions to display</span>
      </div>
    );
  }

  const totalHoldings = portfolio.holdings_value || 1;

  return (
    <div className="flex-1 flex flex-wrap gap-1.5 p-2 content-start overflow-auto">
      {portfolio.positions.map((pos) => {
        const weight = pos.current_value / totalHoldings;
        const pnlPct = pos.pnl_percent;
        const intensity = Math.min(Math.abs(pnlPct) / 12, 1);

        const isUp = pnlPct > 0;
        const isDown = pnlPct < 0;

        const bg = isUp
          ? `rgba(63, 185, 80, ${0.08 + intensity * 0.35})`
          : isDown
          ? `rgba(248, 81, 73, ${0.08 + intensity * 0.35})`
          : "rgba(139, 148, 158, 0.08)";

        const border = isUp
          ? `rgba(63, 185, 80, ${0.25 + intensity * 0.4})`
          : isDown
          ? `rgba(248, 81, 73, ${0.25 + intensity * 0.4})`
          : "#30363d";

        const minW = Math.max(weight * 100, 12);

        return (
          <div
            key={pos.ticker}
            style={{
              width: `${minW}%`,
              minWidth: 64,
              flexGrow: weight * 12,
              backgroundColor: bg,
              borderColor: border,
            }}
            className="border rounded-md p-2 flex flex-col justify-between min-h-[64px] cursor-default transition-all hover:brightness-125"
          >
            <div className="flex items-start justify-between gap-0.5 min-w-0">
              <span className="font-mono text-[11px] font-bold text-text leading-none truncate">{pos.ticker}</span>
              <span className={`font-mono text-[9px] font-bold tabular-nums leading-none shrink-0 ${
                isUp ? "text-up" : isDown ? "text-down" : "text-text-dim"
              }`}>
                {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-end justify-between gap-0.5 min-w-0">
              <div className="font-mono text-[10px] text-text tabular-nums font-semibold truncate">
                ${pos.current_value >= 1000
                  ? (pos.current_value / 1000).toFixed(1) + "k"
                  : pos.current_value.toFixed(0)}
              </div>
              <div className="font-mono text-[9px] text-text-dim tabular-nums shrink-0">
                {(weight * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
