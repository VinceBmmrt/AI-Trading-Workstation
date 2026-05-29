"use client";

import { useState } from "react";

interface Props {
  ticker: string;
  currentPrice: number | null;
  onClose: () => void;
  onSubmit: (targetPrice: number, direction: "above" | "below") => Promise<void>;
}

export default function AlertPopover({ ticker, currentPrice, onClose, onSubmit }: Props) {
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [priceInput, setPriceInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const parsed = parseFloat(priceInput);
    if (!priceInput || parsed <= 0 || isNaN(parsed)) {
      setError("Enter a valid positive price");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit(parsed, direction);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create alert");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-start"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded p-3 ml-2 mb-2 w-52 shadow-xl font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] text-text-dim uppercase tracking-widest mb-2">
          {ticker} Price Alert
        </div>

        <div className="flex gap-1">
          {(["above", "below"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`flex-1 text-[10px] px-1 py-1 rounded uppercase font-mono border transition-colors ${
                direction === d
                  ? "bg-blue/20 text-blue border border-blue/40"
                  : "bg-bg text-text-dim border border-border"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <input
          type="number"
          step="0.01"
          min="0.01"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          placeholder={currentPrice ? currentPrice.toFixed(2) : "Price"}
          className="w-full bg-bg border border-border rounded px-2 py-1 text-xs font-mono text-text mt-2"
        />

        {error && <p className="text-down text-[10px] mt-1">{error}</p>}

        <div className="flex gap-1 mt-2">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 text-[10px] px-2 py-1 rounded bg-blue/20 text-blue border border-blue/40 font-mono uppercase"
          >
            {loading ? "..." : "Set"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-[10px] px-2 py-1 rounded bg-bg text-text-dim border border-border font-mono uppercase"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
