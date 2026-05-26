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
  tickers,
  prices,
  history,
  flashing,
  selectedTicker,
  onSelectTicker,
  onWatchlistChange,
}: Props) {
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const t = addInput.trim().toUpperCase();
    if (!t) return;
    setAddError("");
    try {
      await addToWatchlist(t);
      setAddInput("");
      onWatchlistChange();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleRemove(ticker: string) {
    try {
      await removeFromWatchlist(ticker);
      onWatchlistChange();
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Column headers */}
      <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr] px-3 py-1.5 border-b border-border-subtle">
        {["TICKER", "PRICE", "CHG%", ""].map((h) => (
          <span key={h} className="text-[10px] font-mono text-text-dim uppercase tracking-wider">{h}</span>
        ))}
      </div>

      {/* Ticker rows */}
      <div className="flex-1 overflow-y-auto">
        {tickers.map((ticker) => {
          const update = prices.get(ticker);
          const hist = history.get(ticker) ?? [];
          const flash = flashing.get(ticker);
          const isSelected = ticker === selectedTicker;
          const pct = update?.change_percent ?? 0;
          const isUp = (update?.direction ?? "flat") === "up";
          const isDown = (update?.direction ?? "flat") === "down";

          return (
            <div
              key={ticker}
              onClick={() => onSelectTicker(ticker)}
              className={[
                "grid grid-cols-[2fr_2fr_1.5fr_1fr] items-center px-3 py-2 cursor-pointer border-b border-border-subtle transition-colors",
                isSelected ? "bg-surface-2" : "hover:bg-surface-2",
                flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : "",
              ].join(" ")}
            >
              <span className={`font-mono text-xs font-semibold ${isSelected ? "text-accent" : "text-text"}`}>
                {ticker}
              </span>
              <span className={`font-mono text-xs tabular-nums ${isUp ? "text-up" : isDown ? "text-down" : "text-text"}`}>
                {update ? `$${update.price.toFixed(2)}` : "—"}
              </span>
              <span className={`font-mono text-xs tabular-nums ${isUp ? "text-up" : isDown ? "text-down" : "text-text-dim"}`}>
                {update ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
              </span>
              <div className="flex items-center gap-1">
                <Sparkline data={hist} width={44} height={18} />
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(ticker); }}
                  className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-text-dim hover:text-down text-xs ml-1 leading-none"
                  aria-label={`Remove ${ticker}`}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add ticker form */}
      <div className="p-3 border-t border-border">
        <form onSubmit={handleAdd} className="flex gap-1.5">
          <input
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value.toUpperCase())}
            placeholder="ADD TICKER"
            maxLength={5}
            className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs font-mono text-text placeholder-text-dim uppercase focus:outline-none focus:border-blue"
          />
          <button
            type="submit"
            className="px-2.5 py-1 bg-blue/20 border border-blue/40 rounded text-xs font-mono text-blue hover:bg-blue/30 transition-colors"
          >
            +
          </button>
        </form>
        {addError && <p className="text-down text-[10px] font-mono mt-1">{addError}</p>}
      </div>
    </div>
  );
}
