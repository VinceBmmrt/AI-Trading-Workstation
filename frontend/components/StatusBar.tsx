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
    if (status === "connected") setLastUpdate(new Date().toLocaleTimeString("en-US", { hour12: false }));
  }, [tick, status]);

  return (
    <div className="flex items-center justify-between px-4 h-5 bg-surface border-t border-border shrink-0 select-none">
      <div className="flex items-center gap-4">
        <span className="text-[9px] font-mono text-text-dim uppercase tracking-wider">
          Finance Ally v1.0
        </span>
        <span className="text-border/40">│</span>
        <span className="text-[9px] font-mono text-text-dim">
          Simulator mode · GBM pricing
        </span>
        {priceCount > 0 && (
          <>
            <span className="text-border/40">│</span>
            <span className="text-[9px] font-mono text-text-dim">
              {priceCount} symbols streaming
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {!!lastUpdate && (
          <span className="text-[9px] font-mono text-text-dim tabular-nums">
            Last tick: {lastUpdate}
          </span>
        )}
        <span className="text-border/40">│</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-1 h-1 rounded-full ${
            status === "connected" ? "bg-up" : status === "reconnecting" ? "bg-accent animate-pulse" : "bg-down"
          }`} />
          <span className={`text-[9px] font-mono uppercase tracking-wider ${
            status === "connected" ? "text-up/70" : status === "reconnecting" ? "text-accent/70" : "text-down/70"
          }`}>
            {status === "connected" ? "Connected" : status === "reconnecting" ? "Reconnecting" : "Disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}
