"use client";

import { useState } from "react";
import { executeTrade } from "@/lib/api";

interface Props {
  selectedTicker: string;
  onTradeComplete: () => void;
}

export default function TradeBar({ selectedTicker, onTradeComplete }: Props) {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const activeTicker = ticker.trim().toUpperCase() || selectedTicker;

  async function doTrade(side: "buy" | "sell") {
    const qty = parseFloat(quantity);
    if (!activeTicker || !qty || qty <= 0) {
      setStatus({ ok: false, msg: "Enter a valid ticker and quantity" });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await executeTrade(activeTicker, qty, side);
      setStatus({
        ok: true,
        msg: `${side.toUpperCase()} ${qty} ${activeTicker} @ $${result.trade.price.toFixed(2)}`,
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
    <div className="px-3 py-2.5 border-t border-border bg-surface">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder={selectedTicker || "TICKER"}
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          maxLength={5}
          className="w-20 bg-bg border border-border rounded px-2 py-1.5 text-xs font-mono text-text placeholder-text-dim uppercase focus:outline-none focus:border-blue"
        />
        <input
          type="number"
          placeholder="QTY"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="0"
          step="1"
          className="w-20 bg-bg border border-border rounded px-2 py-1.5 text-xs font-mono text-text placeholder-text-dim focus:outline-none focus:border-blue"
        />
        <button
          onClick={() => doTrade("buy")}
          disabled={loading}
          className="px-3 py-1.5 bg-blue/20 border border-blue/50 rounded text-xs font-mono font-semibold text-blue hover:bg-blue/30 disabled:opacity-40 transition-colors"
        >
          BUY
        </button>
        <button
          onClick={() => doTrade("sell")}
          disabled={loading}
          className="px-3 py-1.5 bg-down/20 border border-down/50 rounded text-xs font-mono font-semibold text-down hover:bg-down/30 disabled:opacity-40 transition-colors"
        >
          SELL
        </button>
      </div>
      {status && (
        <p className={`mt-1.5 text-[11px] font-mono ${status.ok ? "text-up" : "text-down"}`}>
          {status.ok ? "✓ " : "✗ "}{status.msg}
        </p>
      )}
    </div>
  );
}
