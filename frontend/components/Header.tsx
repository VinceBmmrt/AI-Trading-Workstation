"use client";

import type { ConnectionStatus, Portfolio } from "@/lib/types";

interface Props {
  portfolio: Portfolio | null;
  status: ConnectionStatus;
}

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  connected: "bg-up",
  reconnecting: "bg-accent animate-pulse",
  disconnected: "bg-down",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "LIVE",
  reconnecting: "RECONNECTING",
  disconnected: "OFFLINE",
};

export default function Header({ portfolio, status }: Props) {
  const totalValue = portfolio?.total_value ?? 0;
  const cash = portfolio?.cash_balance ?? 0;

  return (
    <header className="flex items-center justify-between px-4 h-11 bg-surface border-b border-border shrink-0">
      {/* Left: brand */}
      <div className="flex items-center gap-3">
        <span className="text-accent font-mono font-semibold tracking-widest text-sm uppercase">
          Finance Ally
        </span>
        <span className="text-border text-xs">|</span>
        <span className="text-text-dim text-xs font-mono uppercase tracking-wider">
          AI Trading Workstation
        </span>
      </div>

      {/* Right: portfolio values + status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim text-xs uppercase tracking-wider">Portfolio</span>
          <span className="font-mono font-semibold text-sm text-text">
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim text-xs uppercase tracking-wider">Cash</span>
          <span className="font-mono text-sm text-text">
            ${cash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[status]}`} />
          <span className="text-xs font-mono text-text-dim">{STATUS_LABEL[status]}</span>
        </div>
      </div>
    </header>
  );
}
