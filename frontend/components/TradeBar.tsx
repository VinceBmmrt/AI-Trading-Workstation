"use client";

import { useState } from "react";
import { executeTrade } from "@/lib/api";
import type { PriceUpdate } from "@/lib/types";

interface Props {
  selectedTicker: string;
  prices: Map<string, PriceUpdate>;
  onTradeComplete: () => void;
}

function fmt2(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TradeBar({ selectedTicker, prices, onTradeComplete }: Props) {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const activeTicker = ticker.trim().toUpperCase() || selectedTicker;
  const qty = parseFloat(quantity);
  const currentPrice = prices.get(activeTicker)?.price ?? null;
  const estimate = currentPrice && !isNaN(qty) && qty > 0 ? currentPrice * qty : null;

  async function doTrade(side: "buy" | "sell") {
    if (!activeTicker || !qty || qty <= 0) {
      setStatus({ ok: false, msg: "Enter ticker and quantity" });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await executeTrade(activeTicker, qty, side);
      setStatus({
        ok: true,
        msg: `${side === "buy" ? "Bought" : "Sold"} ${qty} ${activeTicker} @ $${fmt2(result.trade.price)}`,
      });
      setQuantity("");
      onTradeComplete();
    } catch (err: unknown) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : "Trade failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-border bg-surface shrink-0">
      {/* Estimate banner */}
      {estimate && (
        <div className="px-3 pt-2 pb-0">
          <div className="flex items-center justify-between text-[9px] font-mono text-text-dim bg-surface-2 border border-border-subtle rounded px-2 py-1">
            <span className="uppercase tracking-widest">Est. Value</span>
            <span className="text-text tabular-nums font-semibold">${fmt2(estimate)}</span>
          </div>
        </div>
      )}

      <div className="px-3 pt-2 pb-2.5 flex flex-col gap-1.5">
        {/* Inputs row */}
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder={selectedTicker || "TICKER"}
            value={ticker}
            onChange={(e) => { setTicker(e.target.value.toUpperCase()); setStatus(null); }}
            maxLength={5}
            className="flex-1 min-w-0 bg-bg border border-border rounded px-2 py-1.5 text-[11px] font-mono text-text placeholder-text-dim uppercase focus:outline-none focus:border-blue/60 transition-colors"
          />
          <input
            type="number"
            placeholder="QTY"
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); setStatus(null); }}
            min="1"
            step="1"
            className="flex-1 min-w-0 bg-bg border border-border rounded px-2 py-1.5 text-[11px] font-mono text-text placeholder-text-dim focus:outline-none focus:border-blue/60 transition-colors"
          />
        </div>

        {/* Current price hint */}
        {currentPrice && activeTicker && (
          <div className="text-[9px] font-mono text-text-dim tabular-nums px-0.5">
            {activeTicker} &nbsp;·&nbsp; ${fmt2(currentPrice)} / share
          </div>
        )}

        {/* Buy/Sell row */}
        <div className="flex gap-1.5">
          <button
            onClick={() => doTrade("buy")}
            disabled={loading}
            className="flex-1 py-2 bg-blue/15 border border-blue/40 rounded text-[11px] font-mono font-bold text-blue hover:bg-blue/25 hover:border-blue/60 active:scale-[0.98] disabled:opacity-30 transition-all"
          >
            {loading ? "…" : "BUY"}
          </button>
          <button
            onClick={() => doTrade("sell")}
            disabled={loading}
            className="flex-1 py-2 bg-down/15 border border-down/40 rounded text-[11px] font-mono font-bold text-down hover:bg-down/25 hover:border-down/60 active:scale-[0.98] disabled:opacity-30 transition-all"
          >
            {loading ? "…" : "SELL"}
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className={`flex items-center gap-1.5 text-[10px] font-mono px-1 leading-tight ${
            status.ok ? "text-up" : "text-down"
          }`}>
            <span>{status.ok ? "✓" : "✗"}</span>
            <span>{status.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
