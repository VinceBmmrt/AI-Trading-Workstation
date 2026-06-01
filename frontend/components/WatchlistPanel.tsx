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
  JPM: "FIN", V: "FIN", GS: "FIN", MS: "FIN", BAC: "FIN", "BRK.B": "FIN",
  JNJ: "HEALTH", UNH: "HEALTH", PFE: "HEALTH", LLY: "HEALTH",
  XOM: "ENERGY", CVX: "ENERGY", OXY: "ENERGY",
  WMT: "CONS", COST: "CONS", MCD: "CONS",
  SPY: "ETF", QQQ: "ETF", IWM: "ETF",
};

const SECTOR_TABS = ["ALL", "TECH", "FIN", "HEALTH", "ENERGY", "CONS", "ETF"] as const;
type SectorTab = (typeof SECTOR_TABS)[number];

// ── Sort ──────────────────────────────────────────────────────────────────────
type SortKey = "price" | "pct" | null;
type SortDir = "asc" | "desc";

// ── Props ─────────────────────────────────────────────────────────────────────
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
  const [sortKey, setSortKey]       = useState<SortKey>(null);
  const [sortDir, setSortDir]       = useState<SortDir>("desc");

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const displayTickers = useMemo(() => {
    let list = tickers.filter((t) => {
      const matchSearch = t.toLowerCase().includes(search.toLowerCase());
      const matchSector = sectorTab === "ALL" || SECTOR_MAP[t] === sectorTab;
      return matchSearch && matchSector;
    });

    if (sortKey) {
      list = [...list].sort((a, b) => {
        const ua = prices.get(a);
        const ub = prices.get(b);
        const va = sortKey === "price" ? (ua?.price ?? 0) : (ua?.change_percent ?? 0);
        const vb = sortKey === "price" ? (ub?.price ?? 0) : (ub?.change_percent ?? 0);
        return sortDir === "desc" ? vb - va : va - vb;
      });
    }

    return list;
  }, [tickers, search, sectorTab, sortKey, sortDir, prices]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* Search bar */}
      <div className="px-2 pt-2 pb-1.5 border-b border-border-subtle shrink-0">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          placeholder="SEARCH SYMBOL…"
          className="w-full bg-bg border border-border-subtle rounded px-2 py-1 text-[10px] font-mono text-text placeholder-text-dim uppercase focus:outline-none focus:border-blue/50 transition-colors"
        />
      </div>

      {/* Sector filter tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto shrink-0 border-b border-border-subtle" style={{ scrollbarWidth: "none" }}>
        {SECTOR_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSectorTab(tab)}
            className={[
              "sector-pill shrink-0 cursor-pointer transition-colors",
              sectorTab === tab ? "sector-pill-active" : "",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid items-center px-2 py-1 border-b border-border-subtle shrink-0"
        style={{ gridTemplateColumns: "6px minmax(0,2.2fr) minmax(0,1.9fr) minmax(0,1.7fr) 32px" }}>
        <span /> {/* accent bar column placeholder */}
        <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest">Sym</span>

        {/* Price header with sort */}
        <button
          onClick={() => toggleSort("price")}
          className="flex items-center gap-0.5 text-[9px] font-mono text-text-dim uppercase tracking-widest hover:text-text transition-colors"
        >
          Price
          <SortArrow active={sortKey === "price"} dir={sortDir} />
        </button>

        {/* Chg% header with sort */}
        <button
          onClick={() => toggleSort("pct")}
          className="flex items-center gap-0.5 text-[9px] font-mono text-text-dim uppercase tracking-widest hover:text-text transition-colors"
        >
          Chg%
          <SortArrow active={sortKey === "pct"} dir={sortDir} />
        </button>

        <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest text-right">7D</span>
      </div>

      {/* Ticker rows */}
      <div className="flex-1 overflow-y-auto">
        {displayTickers.length === 0 && (
          <div className="px-3 py-4 text-[10px] font-mono text-text-dim text-center">
            No tickers match
          </div>
        )}

        {displayTickers.map((ticker) => {
          const update     = prices.get(ticker);
          const hist       = history.get(ticker) ?? [];
          const flash      = flashing.get(ticker);
          const isSelected = ticker === selectedTicker;
          const pct        = update?.change_percent ?? 0;
          const dir        = update?.direction ?? "flat";
          const isUp       = dir === "up";
          const isDown     = dir === "down";
          const sector     = SECTOR_MAP[ticker];

          const hasActiveAlert = alerts.some((a) => a.ticker === ticker && a.active);

          const leftBorderColor = isSelected
            ? "var(--color-accent)"
            : isUp
            ? "var(--color-up)"
            : isDown
            ? "var(--color-down)"
            : "var(--color-border-subtle)";

          return (
            <div
              key={ticker}
              onClick={() => onSelectTicker(ticker)}
              className={[
                "group",
                "grid items-center px-2 cursor-pointer border-b border-border-subtle",
                "transition-colors duration-75",
                isSelected ? "bg-surface-2" : "hover:bg-surface-2/50",
                flash === "up"   ? "flash-up"   : "",
                flash === "down" ? "flash-down" : "",
              ].join(" ")}
              style={{
                gridTemplateColumns: "6px minmax(0,2.2fr) minmax(0,1.9fr) minmax(0,1.7fr) 32px",
                height: "26px",
                borderLeft: `2px solid ${leftBorderColor}`,
              }}
            >
              {/* Left accent bar — handled by border-left on parent */}
              <span />

              {/* Ticker symbol */}
              <span className={`font-mono text-[11px] font-bold tracking-wide truncate leading-none ${
                isSelected ? "text-accent" : "text-text"
              }`}>
                {ticker}
              </span>

              {/* Price */}
              <span className={`font-mono text-[10px] tabular-nums leading-none ${
                isUp ? "text-up" : isDown ? "text-down" : "text-text"
              }`}>
                {update ? `$${update.price.toFixed(2)}` : <span className="text-text-dim">—</span>}
              </span>

              {/* Change % */}
              <span className={`font-mono text-[10px] tabular-nums leading-none ${
                isUp ? "text-up" : isDown ? "text-down" : "text-text-dim"
              }`}>
                {update
                  ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
                  : <span className="text-text-dim">—</span>
                }
              </span>

              {/* Sparkline / hover actions */}
              <div className="relative flex items-center justify-end h-full overflow-hidden">
                {/* Default: sparkline */}
                <div className="group-hover:opacity-0 transition-opacity duration-100">
                  <Sparkline data={hist} width={30} height={16} />
                </div>

                {/* Hover overlay: sector pill + alert + remove */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-end gap-0.5 transition-opacity duration-100">
                  {sector && (
                    <span className="sector-pill" title={sector}>
                      {sector}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setAlertPopoverTicker(ticker); }}
                    aria-label="Set price alert"
                    className={`text-[11px] leading-none px-0.5 ${hasActiveAlert ? "text-yellow-400" : "text-text-dim/60 hover:text-text-dim"}`}
                  >
                    🔔
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(ticker); }}
                    aria-label="Remove ticker"
                    className="text-[13px] leading-none px-0.5 text-text-dim/60 hover:text-down"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          );
        })}
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

      {/* Add ticker form */}
      <div className="p-2 border-t border-border shrink-0">
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
        {!!addError && (
          <p className="text-down text-[10px] font-mono mt-1 leading-snug">{addError}</p>
        )}
      </div>
    </div>
  );
}

// ── Sort arrow indicator ───────────────────────────────────────────────────
function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`text-[7px] leading-none ${active ? "text-accent" : "text-text-dim/40"}`}>
      {active ? (dir === "desc" ? "▼" : "▲") : "⇅"}
    </span>
  );
}
