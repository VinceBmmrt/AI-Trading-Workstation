"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/lib/types";

interface Props {
  status: ConnectionStatus;
  priceCount: number;
}

export default function StatusBar({ status, priceCount }: Props) {
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (status === "connected") {
      setLastUpdate(new Date().toLocaleTimeString("en-US", { hour12: false }));
    }
  }, [tick, status]);

  const connectedColor =
    status === "connected" ? "text-up/70"
    : status === "reconnecting" ? "text-accent/70"
    : "text-down/70";

  const dotColor =
    status === "connected" ? "bg-up"
    : status === "reconnecting" ? "bg-accent animate-pulse"
    : "bg-down";

  const connLabel =
    status === "connected" ? "CONNECTED"
    : status === "reconnecting" ? "RECONNECTING…"
    : "DISCONNECTED";

  return (
    <div className="flex items-center justify-between px-4 h-5 bg-surface border-t border-border shrink-0 select-none overflow-hidden">

      {/* Left cluster */}
      <div className="flex items-center gap-3 min-w-0">
        {/* App identity */}
        <span className="text-[9px] font-mono text-text-dim uppercase tracking-wider shrink-0">
          Finance Ally v1.0
        </span>

        <span className="text-border/40 shrink-0">│</span>

        {/* Paper trading badge */}
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-accent shrink-0">
          PAPER
        </span>

        <span className="text-border/40 shrink-0">│</span>

        {/* Mode */}
        <span className="text-[9px] font-mono text-text-dim shrink-0">
          GBM simulator
        </span>

        {/* Ticker count */}
        {priceCount > 0 && (
          <>
            <span className="text-border/40 shrink-0">│</span>
            <span className="text-[9px] font-mono text-text-dim tabular-nums shrink-0">
              {priceCount} tickers
            </span>
          </>
        )}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3 shrink-0">
        {!!lastUpdate && (
          <span className="text-[9px] font-mono text-text-dim tabular-nums">
            {lastUpdate}
          </span>
        )}

        <span className="text-border/40">│</span>

        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <span className={`w-1 h-1 rounded-full ${dotColor}`} />
          <span className={`text-[9px] font-mono uppercase tracking-wider ${connectedColor}`}>
            {connLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
