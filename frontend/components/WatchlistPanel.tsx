"use client";

import { useState } from "react";
import Sparkline from "./Sparkline";
import type { PriceUpdate } from "@/lib/types";
import { addToWatchlist, removeFromWatchlist } from "@/lib/api";

interface Props {
  tickers: string[];
  prices: Map<string, PriceUpdate>;
  history: Map<string, number[]>;
  flashing: Map<string, "up" | "down">;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  onWatchlistChange: () => void;
}

export default function WatchlistPanel({
  tickers, prices, history, flashing,
  selectedTicker, onSelectTicker, onWatchlistChange,
}: Props) {
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const t = addInput.trim().toUpperCase();
    if (!t) return;
    setAddError("");
    setAddLoading(true);
    try {
      await addToWatchlist(t);
      setAddInput("");
      onWatchlistChange();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Error adding ticker");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(ticker: string) {
    try {
      await removeFromWatchlist(ticker);
      onWatchlistChange();
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Column headers */}
      <div className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,2fr)_minmax(0,1.8fr)_40px] items-center px-3 py-1.5 border-b border-border-subtle">
        <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest">Ticker</span>
        <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest">Price</span>
        <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest">Chg%</span>
        <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest text-right">7D</span>
      </div>

      {/* Ticker rows */}
      <div className="flex-1 overflow-y-auto">
        {tickers.map((ticker) => {
          const update = prices.get(ticker);
          const hist = history.get(ticker) ?? [];
          const flash = flashing.get(ticker);
          const isSelected = ticker === selectedTicker;
          const pct = update?.change_percent ?? 0;
          const dir = update?.direction ?? "flat";
          const isUp   = dir === "up";
          const isDown = dir === "down";

          return (
            <div
              key={ticker}
              onClick={() => onSelectTicker(ticker)}
              className={[
                "group",
                "grid grid-cols-[minmax(0,2.5fr)_minmax(0,2fr)_minmax(0,1.8fr)_40px] items-center",
                "px-3 py-2 cursor-pointer border-b border-border-subtle",
                "transition-colors duration-75",
                isSelected
                  ? "bg-surface-2 border-l-2 border-l-accent"
                  : "hover:bg-surface-2/60 border-l-2 border-l-transparent",
                flash === "up"   ? "flash-up"   : "",
                flash === "down" ? "flash-down" : "",
              ].join(" ")}
            >
              {/* Ticker symbol */}
              <span className={`font-mono text-[11px] font-bold tracking-wide truncate ${
                isSelected ? "text-accent" : "text-text"
              }`}>
                {ticker}
              </span>

              {/* Price */}
              <span className={`font-mono text-[11px] tabular-nums ${
                isUp ? "text-up" : isDown ? "text-down" : "text-text"
              }`}>
                {update ? `$${update.price.toFixed(2)}` : <span className="text-text-dim">—</span>}
              </span>

              {/* Change % */}
              <span className={`font-mono text-[10px] tabular-nums ${
                isUp ? "text-up" : isDown ? "text-down" : "text-text-dim"
              }`}>
                {update
                  ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
                  : <span className="text-text-dim">—</span>
                }
              </span>

              {/* Sparkline + remove */}
              <div className="relative flex items-center justify-end">
                <Sparkline data={hist} width={38} height={20} />
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(ticker); }}
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-surface-2/90 text-text-dim hover:text-down text-sm transition-opacity rounded-sm"
                  aria-label={`Remove ${ticker}`}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add ticker */}
      <div className="p-2.5 border-t border-border shrink-0">
        <form onSubmit={handleAdd} className="flex gap-1.5">
          <input
            type="text"
            value={addInput}
            onChange={(e) => { setAddInput(e.target.value.toUpperCase()); setAddError(""); }}
            placeholder="ADD SYMBOL…"
            maxLength={5}
            className="flex-1 min-w-0 bg-bg border border-border rounded px-2 py-1.5 text-[10px] font-mono text-text placeholder-text-dim uppercase focus:outline-none focus:border-blue/60 transition-colors"
          />
          <button
            type="submit"
            disabled={addLoading || !addInput.trim()}
            className="px-3 py-1.5 bg-blue/15 border border-blue/40 rounded text-[11px] font-mono font-bold text-blue hover:bg-blue/25 disabled:opacity-30 transition-colors"
          >
            {addLoading ? "…" : "+"}
          </button>
        </form>
        {addError && (
          <p className="text-down text-[10px] font-mono mt-1.5 leading-snug">{addError}</p>
        )}
      </div>
    </div>
  );
}
