"use client";

import type { Portfolio } from "@/lib/types";

interface Props {
  portfolio: Portfolio | null;
}

const LABEL = "text-[9px] font-mono text-text-dim uppercase tracking-widest";
const CELL = "font-mono text-xs tabular-nums";

export default function PositionsTable({ portfolio }: Props) {
  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-dim">
        <span className="text-2xl opacity-20">◈</span>
        <span className="text-[10px] font-mono uppercase tracking-widest">No open positions</span>
        <span className="text-[10px] font-mono text-text-dim/50">Use the trade bar to buy your first stock</span>
      </div>
    );
  }

  const maxAbsPnlPct = Math.max(...portfolio.positions.map((p) => Math.abs(p.pnl_percent)), 0.01);

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-border sticky top-0 bg-surface z-10">
          {["Ticker", "Qty", "Avg Cost", "Price", "Value", "P&L", "%"].map((h) => (
            <th key={h} className={`${LABEL} px-3 py-2 font-normal`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {portfolio.positions.map((pos) => {
          const isUp = pos.unrealized_pnl >= 0;
          const barWidth = Math.min((Math.abs(pos.pnl_percent) / maxAbsPnlPct) * 100, 100);

          return (
            <tr key={pos.ticker} className="border-b border-border-subtle hover:bg-surface-2 transition-colors group">
              <td className={`${CELL} px-3 py-2`}>
                <span className="text-accent font-semibold tracking-wide">{pos.ticker}</span>
              </td>
              <td className={`${CELL} px-3 py-2 text-text`}>{pos.quantity}</td>
              <td className={`${CELL} px-3 py-2 text-text-dim`}>${pos.avg_cost.toFixed(2)}</td>
              <td className={`${CELL} px-3 py-2 text-text`}>${pos.current_price.toFixed(2)}</td>
              <td className={`${CELL} px-3 py-2 text-text`}>${pos.current_value.toFixed(2)}</td>
              <td className={`${CELL} px-3 py-2 ${isUp ? "text-up" : "text-down"}`}>
                {isUp ? "+" : ""}${pos.unrealized_pnl.toFixed(2)}
              </td>
              <td className={`${CELL} px-3 py-2`}>
                <div className="flex items-center gap-2">
                  <span className={isUp ? "text-up" : "text-down"}>
                    {isUp ? "+" : ""}{pos.pnl_percent.toFixed(2)}%
                  </span>
                  {/* P&L intensity bar */}
                  <div className="w-12 h-1 bg-surface-2 rounded-full overflow-hidden shrink-0">
                    <div
                      className={`h-full rounded-full transition-all ${isUp ? "bg-up/70" : "bg-down/70"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
