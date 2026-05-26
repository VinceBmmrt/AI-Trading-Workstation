"use client";

import type { Portfolio } from "@/lib/types";

interface Props {
  portfolio: Portfolio | null;
}

const COL = "text-[10px] font-mono text-text-dim uppercase tracking-wider";
const CELL = "font-mono text-xs tabular-nums";

export default function PositionsTable({ portfolio }: Props) {
  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-text-dim text-xs font-mono">
        NO OPEN POSITIONS
      </div>
    );
  }

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-border">
          {["Ticker", "Qty", "Avg Cost", "Price", "Value", "P&L", "%"].map((h) => (
            <th key={h} className={`${COL} px-3 py-1.5 font-normal`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {portfolio.positions.map((pos) => {
          const isUp = pos.unrealized_pnl >= 0;
          return (
            <tr key={pos.ticker} className="border-b border-border-subtle hover:bg-surface-2 transition-colors">
              <td className={`${CELL} px-3 py-1.5 text-accent font-semibold`}>{pos.ticker}</td>
              <td className={`${CELL} px-3 py-1.5 text-text`}>{pos.quantity}</td>
              <td className={`${CELL} px-3 py-1.5 text-text-dim`}>${pos.avg_cost.toFixed(2)}</td>
              <td className={`${CELL} px-3 py-1.5 text-text`}>${pos.current_price.toFixed(2)}</td>
              <td className={`${CELL} px-3 py-1.5 text-text`}>${pos.current_value.toFixed(2)}</td>
              <td className={`${CELL} px-3 py-1.5 ${isUp ? "text-up" : "text-down"}`}>
                {isUp ? "+" : ""}${pos.unrealized_pnl.toFixed(2)}
              </td>
              <td className={`${CELL} px-3 py-1.5 ${isUp ? "text-up" : "text-down"}`}>
                {isUp ? "+" : ""}{pos.pnl_percent.toFixed(2)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
