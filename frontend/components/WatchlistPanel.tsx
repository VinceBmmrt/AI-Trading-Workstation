"use client";

import { useState, useMemo } from "react";
import Sparkline from "./Sparkline";
import AlertPopover from "./AlertPopover";
import type { PriceUpdate, Alert } from "@/lib/types";
import { addToWatchlist, removeFromWatchlist } from "@/lib/api";

// ── Sector map ──────────────────────────────────────────────────────────────
type Sector = "TECH" | "FIN" | "HEALTH" | "ENERGY" | "CONS" | "ETF";

const SECTOR_MAP: Record<string, Sector> = {
  AAPL: "TECH", GOOGL: "TECH", MSFT: "TECH", AMZN: "TECH", TSLA: "TECH",
  NVDA: "TECH", META: "TECH", NFLX: "TECH", AMD: "TECH", INTC: "TECH",
  CRM: "TECH", ORCL: "TECH", SNOW: "TECH", PLTR: "TECH",
  JPM: "FIN", V: "FIN", GS: "FIN", MS: "FIN", BAC: "FIN", AXP: "FIN",
  JNJ: "HEALTH", UNH: "HEALTH", PFE: "HEALTH", LLY: "HEALTH",
  XOM: "ENERGY", CVX: "ENERGY", OXY: "ENERGY",
  WMT: "CONS", COST: "CONS", MCD: "CONS",
  SPY: "ETF", QQQ: "ETF", IWM: "ETF",
};

const SECTOR_TABS = ["ALL", "TECH", "FIN", "HEALTH", "ENERGY", "CONS", "ETF"] as const;
type SectorTab = (typeof SECTOR_TABS)[number];

const SECTOR_ACCENT: Record<string, string> = {
  TECH: "#209dd7", FIN: "#3fb950", HEALTH: "#79c0ff",
  ENERGY: "#d29922", CONS: "#ecad0a", ETF: "#753991",
};

interface Props {
  tickers: string[];
  prices: Map<string, PriceUpdate>;
  history: Map<string, number[]>;
  flashing: Map<string, "up" | "down">;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  onWatchlistChange: () => void;
  alerts: Alert[];
  onCreateAlert: (ticker: string, targetPrice: number, direction: "above" | "below") => Promise<void>;
}

export default function WatchlistPanel({
  tickers, prices, history, flashing,
  selectedTicker, onSelectTicker, onWatchlistChange,
  alerts, onCreateAlert,
}: Props) {
  const [addInput, setAddInput]     = useState("");
  const [addError, setAddError]     = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [alertPopoverTicker, setAlertPopoverTicker] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [sectorTab, setSectorTab]   = useState<SectorTab>("ALL");

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

  const displayTickers = useMemo(() => {
    return tickers.filter((t) => {
      const matchSearch = search === "" || t.includes(search);
      const matchSector = sectorTab === "ALL" || SECTOR_MAP[t] === sectorTab;
      return matchSearch && matchSector;
    });
  }, [tickers, search, sectorTab]);

  // Aggregate stats for the active tab
  const stats = useMemo(() => {
    const gainers = displayTickers.filter(t => (prices.get(t)?.change_percent ?? 0) > 0).length;
    const losers  = displayTickers.filter(t => (prices.get(t)?.change_percent ?? 0) < 0).length;
    return { gainers, losers };
  }, [displayTickers, prices]);

  return (
    <div className="flex flex-col h-full">

      {/* Search bar */}
      <div className="px-2 pt-2 pb-1.5 shrink-0">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          placeholder="SEARCH…"
          className="w-full bg-surface-2 border border-border-subtle rounded px-2.5 py-1.5 text-[10px] font-mono text-text placeholder-text-dim uppercase focus:outline-none focus:border-blue/50 transition-colors"
        />
      </div>

      {/* Sector filter tabs */}
      <div
        className="flex items-center gap-1 px-2 pb-1.5 overflow-x-auto shrink-0"
        style={{ scrollbarWidth: "none" }}
      >
        {SECTOR_TABS.map((tab) => {
          const active = sectorTab === tab;
          const accent = tab === "ALL" ? "var(--color-text-dim)" : SECTOR_ACCENT[tab];
          return (
            <button
              key={tab}
              onClick={() => setSectorTab(tab)}
              style={active ? { color: accent, borderColor: accent, background: `${accent}15` } : {}}
              className={[
                "shrink-0 px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider cursor-pointer transition-all border",
                active
                  ? "border-current"
                  : "text-text-dim border-border-subtle hover:text-text hover:border-border",
              ].join(" ")}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between px-2 pb-1 shrink-0">
        <span className="text-[9px] font-mono text-text-dim tabular-nums">
          {displayTickers.length} symbols
        </span>
        <div className="flex items-center gap-2 text-[9px] font-mono tabular-nums">
          <span className="text-up">▲{stats.gainers}</span>
          <span className="text-down">▼{stats.losers}</span>
        </div>
      </div>

      {/* 2-column compact grid */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-1">
        {displayTickers.length === 0 ? (
          <div className="py-8 text-center text-[10px] font-mono text-text-dim">
            No symbols match
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {displayTickers.map((ticker) => (
              <TickerCard
                key={ticker}
                ticker={ticker}
                update={prices.get(ticker)}
                hist={history.get(ticker) ?? []}
                flash={flashing.get(ticker)}
                isSelected={ticker === selectedTicker}
                hasAlert={alerts.some(a => a.ticker === ticker && a.active)}
                onSelect={() => onSelectTicker(ticker)}
                onAlert={() => setAlertPopoverTicker(ticker)}
                onRemove={() => handleRemove(ticker)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Alert popover */}
      {alertPopoverTicker && (
        <AlertPopover
          ticker={alertPopoverTicker}
          currentPrice={prices.get(alertPopoverTicker)?.price ?? null}
          onClose={() => setAlertPopoverTicker(null)}
          onSubmit={async (tp, dir) => {
            await onCreateAlert(alertPopoverTicker, tp, dir);
            setAlertPopoverTicker(null);
          }}
        />
      )}

      {/* Add ticker */}
      <div className="px-2 pb-2 pt-1.5 border-t border-border shrink-0">
        <form onSubmit={handleAdd} className="flex gap-1.5">
          <input
            type="text"
            value={addInput}
            onChange={(e) => { setAddInput(e.target.value.toUpperCase()); setAddError(""); }}
            placeholder="ADD SYMBOL…"
            maxLength={5}
            className="flex-1 min-w-0 bg-surface-2 border border-border-subtle rounded px-2 py-1.5 text-[10px] font-mono text-text placeholder-text-dim uppercase focus:outline-none focus:border-blue/60 transition-colors"
          />
          <button
            type="submit"
            disabled={addLoading || !addInput.trim()}
            className="px-3 py-1.5 bg-blue/15 border border-blue/40 rounded text-[11px] font-mono font-bold text-blue hover:bg-blue/25 disabled:opacity-30 transition-colors"
          >
            {addLoading ? "…" : "+"}
          </button>
        </form>
        {!!addError && (
          <p className="text-down text-[9px] font-mono mt-1 leading-snug">{addError}</p>
        )}
      </div>
    </div>
  );
}

// ── Compact ticker card ────────────────────────────────────────────────────
interface CardProps {
  ticker: string;
  update: PriceUpdate | undefined;
  hist: number[];
  flash: "up" | "down" | undefined;
  isSelected: boolean;
  hasAlert: boolean;
  onSelect: () => void;
  onAlert: () => void;
  onRemove: () => void;
}

function TickerCard({ ticker, update, hist, flash, isSelected, hasAlert, onSelect, onAlert, onRemove }: CardProps) {
  const pct     = update?.change_percent ?? 0;
  const isUp    = update?.direction === "up";
  const isDown  = update?.direction === "down";
  const sector  = SECTOR_MAP[ticker];
  const accent  = sector ? SECTOR_ACCENT[sector] : "var(--color-border)";

  const borderColor = isSelected
    ? "var(--color-accent)"
    : isUp ? "var(--color-up)"
    : isDown ? "var(--color-down)"
    : "var(--color-border-subtle)";

  return (
    <div
      onClick={onSelect}
      className={[
        "group relative flex flex-col rounded cursor-pointer select-none",
        "border transition-all duration-75",
        "overflow-hidden",
        isSelected ? "bg-surface-2" : "bg-surface hover:bg-surface-2/80",
        flash === "up"   ? "flash-up"   : "",
        flash === "down" ? "flash-down" : "",
      ].join(" ")}
      style={{ borderColor: isSelected ? "var(--color-accent)" : "var(--color-border-subtle)" }}
    >
      {/* Top accent bar colored by direction */}
      <div className="h-px w-full shrink-0" style={{ backgroundColor: borderColor }} />

      <div className="px-2 pt-1 pb-1.5 flex flex-col gap-0.5 min-w-0">
        {/* Row 1: ticker + sector dot */}
        <div className="flex items-center justify-between min-w-0">
          <span
            className="font-mono text-[11px] font-bold tracking-wide truncate leading-none"
            style={{ color: isSelected ? "var(--color-accent)" : "var(--color-text)" }}
          >
            {ticker}
          </span>
          {sector && (
            <span
              className="text-[7px] font-mono font-bold uppercase tracking-wider leading-none shrink-0 ml-1"
              style={{ color: accent, opacity: 0.7 }}
            >
              {sector}
            </span>
          )}
        </div>

        {/* Row 2: price */}
        <span
          className="font-mono text-[11px] tabular-nums font-semibold leading-none"
          style={{ color: isUp ? "var(--color-up)" : isDown ? "var(--color-down)" : "var(--color-text)" }}
        >
          {update ? `$${update.price.toFixed(2)}` : "—"}
        </span>

        {/* Row 3: chg% + sparkline */}
        <div className="flex items-end justify-between gap-1">
          <span
            className="font-mono text-[9px] tabular-nums leading-none"
            style={{ color: isUp ? "var(--color-up)" : isDown ? "var(--color-down)" : "var(--color-text-dim)" }}
          >
            {update ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
          </span>
          <div className="opacity-70 group-hover:opacity-0 transition-opacity shrink-0">
            <Sparkline data={hist} width={40} height={16} />
          </div>
        </div>
      </div>

      {/* Hover overlay: alert + remove */}
      <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onAlert(); }}
          aria-label="Set alert"
          className={`text-[10px] leading-none px-0.5 ${hasAlert ? "text-yellow-400" : "text-text-dim/50 hover:text-text-dim"}`}
        >
          🔔
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove"
          className="text-[12px] leading-none px-0.5 text-text-dim/50 hover:text-down"
        >
          ×
        </button>
      </div>
    </div>
  );
}
