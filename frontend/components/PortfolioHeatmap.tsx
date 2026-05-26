"use client";

import type { Portfolio } from "@/lib/types";

interface Props {
  portfolio: Portfolio | null;
}

export default function PortfolioHeatmap({ portfolio }: Props) {
  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-xs font-mono">
        NO POSITIONS
      </div>
    );
  }

  const totalHoldings = portfolio.holdings_value || 1;

  return (
    <div className="flex flex-wrap gap-1 p-2 h-full content-start">
      {portfolio.positions.map((pos) => {
        const weight = pos.current_value / totalHoldings;
        const pnlPct = pos.pnl_percent;
        const intensity = Math.min(Math.abs(pnlPct) / 10, 1);

        const bgColor = pnlPct > 0
          ? `rgba(63, 185, 80, ${0.15 + intensity * 0.4})`
          : pnlPct < 0
          ? `rgba(248, 81, 73, ${0.15 + intensity * 0.4})`
          : "rgba(139, 148, 158, 0.15)";

        const borderColor = pnlPct > 0 ? "#3fb950" : pnlPct < 0 ? "#f85149" : "#30363d";
        const minW = Math.max(weight * 100, 15);

        return (
          <div
            key={pos.ticker}
            style={{
              width: `${minW}%`,
              minWidth: 60,
              flexGrow: weight * 10,
              backgroundColor: bgColor,
              borderColor,
            }}
            className="border rounded p-2 flex flex-col justify-between min-h-[60px] cursor-default"
          >
            <span className="font-mono text-xs font-semibold text-text">{pos.ticker}</span>
            <div>
              <div className="font-mono text-[11px] text-text-dim tabular-nums">
                ${pos.current_value.toFixed(0)}
              </div>
              <div className={`font-mono text-[11px] tabular-nums font-semibold ${pnlPct >= 0 ? "text-up" : "text-down"}`}>
                {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
