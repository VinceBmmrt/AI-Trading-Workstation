"use client";

import { useEffect, useRef } from "react";
import type { HistoryPoint } from "@/lib/types";

interface Props {
  history: HistoryPoint[];
}

const STARTING_CAPITAL = 10_000;

export default function PnLChart({ history }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || history.length === 0) return;

    import("lightweight-charts").then(({ createChart, AreaSeries }) => {
      if (!containerRef.current) return;

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const lastVal = history[history.length - 1]?.total_value ?? STARTING_CAPITAL;
      const isUp = lastVal >= STARTING_CAPITAL;

      const lineColor = isUp ? "#3fb950" : "#f85149";
      const topColor  = isUp ? "rgba(63,185,80,0.22)"  : "rgba(248,81,73,0.22)";
      const botColor  = isUp ? "rgba(63,185,80,0.01)"  : "rgba(248,81,73,0.01)";

      const chart = createChart(containerRef.current, {
        layout: {
          background: { color: "#161b22" },
          textColor: "#7d8590",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1c2128" },
          horzLines: { color: "#1c2128" },
        },
        rightPriceScale: { borderColor: "#21262d", textColor: "#7d8590" },
        timeScale: {
          borderColor: "#21262d",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScale: false,
        handleScroll: false,
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor,
        topColor,
        bottomColor: botColor,
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: "#ecad0a",
        priceLineStyle: 2,
        lastValueVisible: true,
        lastPriceAnimation: 1,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: lineColor,
        crosshairMarkerBackgroundColor: "#0d1117",
      });

      const seen = new Set<number>();
      const data = history
        .map((p) => ({
          time: Math.floor(new Date(p.recorded_at).getTime() / 1000) as import("lightweight-charts").Time,
          value: p.total_value,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number))
        .filter((d) => { const t = d.time as number; if (seen.has(t)) return false; seen.add(t); return true; });
      series.setData(data);
      chartRef.current = chart;

      const ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      if (containerRef.current) ro.observe(containerRef.current);

      return () => { ro.disconnect(); chart.remove(); };
    });

    return () => {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full text-text-dim">
        <span className="text-2xl opacity-20">◈</span>
        <span className="text-[10px] font-mono uppercase tracking-widest">No history yet</span>
        <span className="text-[10px] font-mono text-text-dim/50">Snapshots recorded every 30 seconds</span>
      </div>
    );
  }

  const first = history[0]?.total_value ?? STARTING_CAPITAL;
  const last  = history[history.length - 1]?.total_value ?? STARTING_CAPITAL;
  const delta = last - first;
  const deltaPct = (delta / first) * 100;
  const isUp = delta >= 0;

  return (
    <div className="flex flex-col h-full">
      {/* Mini stats row */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className="text-text-dim">Start</span>
          <span className="text-text tabular-nums">${first.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className="text-text-dim">Current</span>
          <span className="text-text tabular-nums font-semibold">${last.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-mono font-semibold tabular-nums px-2 py-0.5 rounded ${
          isUp ? "bg-up/10 border border-up/25 text-up" : "bg-down/10 border border-down/25 text-down"
        }`}>
          {isUp ? "+" : ""}{delta.toFixed(2)} ({isUp ? "+" : ""}{deltaPct.toFixed(2)}%)
        </div>
        <span className="ml-auto text-[9px] font-mono text-text-dim tabular-nums">
          {history.length} snapshots
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
