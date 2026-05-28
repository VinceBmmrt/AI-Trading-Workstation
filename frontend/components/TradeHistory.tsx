"use client";

import type { TradeRecord } from "@/lib/types";

interface Props {
  trades: TradeRecord[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

function exportCsv(trades: TradeRecord[]) {
  if (typeof window === "undefined") return;
  const header = "ID,Ticker,Side,Quantity,Price,Total,Executed At\n";
  const rows = trades.map((t) =>
    [t.id, t.ticker, t.side, t.quantity, t.price, t.total, t.executed_at].join(",")
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "trade_history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function TradeHistory({ trades }: Props) {
  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-xs font-mono">
        No trades yet — execute a trade to see history.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest">
          {trades.length} trade{trades.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => exportCsv(trades)}
          className="text-[9px] font-mono uppercase tracking-widest text-blue hover:text-blue/80 transition-colors cursor-pointer"
        >
          ↓ Export CSV
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs font-mono">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="text-[9px] text-text-dim uppercase tracking-widest border-b border-border">
              <th className="px-3 py-1.5 text-left">Time</th>
              <th className="px-3 py-1.5 text-left">Ticker</th>
              <th className="px-3 py-1.5 text-left">Side</th>
              <th className="px-3 py-1.5 text-right">Qty</th>
              <th className="px-3 py-1.5 text-right">Price</th>
              <th className="px-3 py-1.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-border/40 hover:bg-surface-2 transition-colors">
                <td className="px-3 py-1 text-text-dim text-[10px]">{formatDate(t.executed_at)}</td>
                <td className="px-3 py-1 text-text font-semibold">{t.ticker}</td>
                <td className={`px-3 py-1 uppercase font-semibold ${t.side === "buy" ? "text-green" : "text-red"}`}>
                  {t.side}
                </td>
                <td className="px-3 py-1 text-right text-text tabular-nums">{t.quantity}</td>
                <td className="px-3 py-1 text-right text-text tabular-nums">
                  ${t.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-1 text-right text-text tabular-nums">
                  ${t.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
