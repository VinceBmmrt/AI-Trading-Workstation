"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus, Portfolio } from "@/lib/types";

interface Props {
  portfolio: Portfolio | null;
  status: ConnectionStatus;
  startingCapital: number;
  onOpenSettings: () => void;
}

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected: "bg-up shadow-[0_0_5px_rgba(63,185,80,0.8)]",
  reconnecting: "bg-accent animate-pulse",
  disconnected: "bg-down",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "LIVE",
  reconnecting: "RECONNECTING…",
  disconnected: "OFFLINE",
};

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connected: "text-up",
  reconnecting: "text-accent",
  disconnected: "text-down",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Header({ portfolio, status, startingCapital, onOpenSettings }: Props) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false, timeZoneName: "short",
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const totalValue  = portfolio?.total_value   ?? 0;
  const cash        = portfolio?.cash_balance  ?? 0;
  const holdings    = portfolio?.holdings_value ?? 0;
  const netPnL      = portfolio ? totalValue - startingCapital : null;
  const netPnLPct   = netPnL !== null ? (netPnL / startingCapital) * 100 : null;
  const isProfit    = netPnL !== null && netPnL >= 0;
  const posCount    = portfolio?.positions.length ?? 0;
  // Dramatic display when P&L is significant (>1% move)
  const isSignificant = netPnLPct !== null && Math.abs(netPnLPct) > 1;

  return (
    <header className="relative flex items-center justify-between px-5 h-11 bg-surface border-b border-border shrink-0 z-20">
      {/* Accent gradient top line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />

      {/* LEFT — brand */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono font-bold text-sm tracking-[0.18em] text-accent uppercase select-none">
          Finance Ally
        </span>
        <span className="text-border/60 text-[10px]">│</span>
        <span className="hidden md:inline font-mono text-[10px] text-text-dim tracking-[0.12em] uppercase">
          AI Trading Workstation
        </span>
      </div>

      {/* CENTER — portfolio metrics */}
      <div className="flex items-center gap-1">
        {/* Portfolio total */}
        <div className="flex flex-col items-center px-4 py-0.5">
          <span className="text-[8px] font-mono text-text-dim uppercase tracking-widest leading-none">Portfolio</span>
          <span className="font-mono font-semibold text-[13px] text-text tabular-nums leading-tight mt-0.5">
            ${fmt(totalValue)}
          </span>
        </div>

        <span className="text-border/40 text-xs">│</span>

        {/* Net P&L — dramatic when significant */}
        {netPnL !== null && (
          <div className={`flex flex-col items-center px-3 py-1 mx-1 rounded border transition-all ${
            isProfit
              ? isSignificant
                ? "bg-up/[0.12] border-up/40 shadow-[0_0_8px_rgba(63,185,80,0.25)]"
                : "bg-up/[0.07] border-up/20"
              : isSignificant
                ? "bg-down/[0.12] border-down/40 shadow-[0_0_8px_rgba(248,81,73,0.25)]"
                : "bg-down/[0.07] border-down/20"
          }`}>
            <span className="text-[8px] font-mono text-text-dim uppercase tracking-widest leading-none">
              {isProfit ? "Unrealized Gain" : "Unrealized Loss"}
            </span>
            <div className={`flex items-baseline gap-1.5 mt-0.5 font-mono tabular-nums font-semibold leading-tight ${
              isSignificant ? "text-[16px]" : "text-[13px]"
            } ${isProfit ? "text-up" : "text-down"}`}>
              <span>{isProfit ? "+" : "−"}${fmt(Math.abs(netPnL))}</span>
              {netPnLPct !== null && (
                <span className={`${isSignificant ? "text-[11px]" : "text-[10px]"} opacity-75 font-normal`}>
                  ({isProfit ? "+" : ""}{netPnLPct.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
        )}

        <span className="hidden lg:inline text-border/40 text-xs">│</span>

        {/* Holdings — hidden on tablet */}
        <div className="hidden lg:flex flex-col items-center px-4 py-0.5">
          <span className="text-[8px] font-mono text-text-dim uppercase tracking-widest leading-none">Holdings</span>
          <span className="font-mono text-[13px] text-text tabular-nums leading-tight mt-0.5">
            ${fmt(holdings)}
          </span>
        </div>

        <span className="text-border/40 text-xs">│</span>

        {/* Cash */}
        <div className="flex flex-col items-center px-4 py-0.5">
          <span className="text-[8px] font-mono text-text-dim uppercase tracking-widest leading-none">Cash</span>
          <span className="font-mono text-[13px] text-text tabular-nums leading-tight mt-0.5">
            ${fmt(cash)}
          </span>
        </div>

        {posCount > 0 && (
          <>
            <span className="hidden lg:inline text-border/40 text-xs">│</span>
            <div className="hidden lg:flex flex-col items-center px-3 py-0.5">
              <span className="text-[8px] font-mono text-text-dim uppercase tracking-widest leading-none">Positions</span>
              <span className="font-mono text-[13px] text-blue tabular-nums leading-tight mt-0.5">{posCount}</span>
            </div>
          </>
        )}
      </div>

      {/* RIGHT — clock + status */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={onOpenSettings}
          className="text-text-dim hover:text-accent transition-colors text-lg leading-none px-1"
          title="Settings"
          aria-label="Settings"
        >
          ⚙
        </button>
        {!!time && (
          <span className="font-mono text-[11px] text-text-dim tabular-nums tracking-wider hidden lg:block">
            {time}
          </span>
        )}
        <div className="flex items-center gap-2 border-l border-border pl-4">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
          <span className={`text-[10px] font-mono tracking-widest ${STATUS_TEXT[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>
    </header>
  );
}
