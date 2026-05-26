"use client";

import type { ConnectionStatus, Portfolio } from "@/lib/types";

interface Props {
  portfolio: Portfolio | null;
  status: ConnectionStatus;
}

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected: "bg-up shadow-[0_0_6px_#3fb950]",
  reconnecting: "bg-accent animate-pulse",
  disconnected: "bg-down",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "LIVE",
  reconnecting: "RECONNECTING",
  disconnected: "OFFLINE",
};

const STARTING_CAPITAL = 10_000;

export default function Header({ portfolio, status }: Props) {
  const totalValue = portfolio?.total_value ?? 0;
  const cash = portfolio?.cash_balance ?? 0;
  const netPnL = portfolio ? totalValue - STARTING_CAPITAL : null;
  const netPnLPct = netPnL !== null ? (netPnL / STARTING_CAPITAL) * 100 : null;
  const isProfit = netPnL !== null && netPnL >= 0;

  return (
    <header className="relative flex items-center justify-between px-5 h-12 bg-surface border-b border-border shrink-0">
      {/* Accent top line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

      {/* Left: brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-accent font-mono font-bold tracking-widest text-sm uppercase">
            Finance Ally
          </span>
          <span className="hidden sm:inline text-border text-xs">│</span>
          <span className="hidden sm:inline text-text-dim text-[10px] font-mono uppercase tracking-widest">
            AI Trading Workstation
          </span>
        </div>
      </div>

      {/* Right: metrics + status */}
      <div className="flex items-center gap-5">
        {/* Portfolio total */}
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest leading-none mb-0.5">Portfolio</span>
          <span className="font-mono font-semibold text-sm text-text tabular-nums leading-none">
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Net P&L */}
        {netPnL !== null && (
          <div className={`flex flex-col items-end px-2.5 py-1 rounded border ${
            isProfit
              ? "border-up/30 bg-up/5"
              : "border-down/30 bg-down/5"
          }`}>
            <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest leading-none mb-0.5">
              {isProfit ? "Gain" : "Loss"}
            </span>
            <span className={`font-mono font-semibold text-sm tabular-nums leading-none ${isProfit ? "text-up" : "text-down"}`}>
              {isProfit ? "+" : ""}${netPnL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[10px] font-normal ml-1 opacity-80">
                ({netPnLPct !== null ? `${isProfit ? "+" : ""}${netPnLPct.toFixed(2)}%` : ""})
              </span>
            </span>
          </div>
        )}

        {/* Cash */}
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest leading-none mb-0.5">Cash</span>
          <span className="font-mono text-sm text-text tabular-nums leading-none">
            ${cash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 border-l border-border pl-5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
          <span className="text-[10px] font-mono text-text-dim tracking-wider">{STATUS_LABEL[status]}</span>
        </div>
      </div>
    </header>
  );
}
