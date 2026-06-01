"use client";

import { useEffect, useRef } from "react";
import type { HistoryPoint } from "@/lib/types";

interface Props {
  history: HistoryPoint[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyHistoryToSeries(series: any, chart: any, history: HistoryPoint[]) {
  if (history.length === 0) return;

  const first = history[0].total_value;
  const last  = history[history.length - 1].total_value;
  const isUp  = last >= first;

  series.applyOptions({
    lineColor:   isUp ? "#3fb950" : "#f85149",
    topColor:    isUp ? "rgba(63,185,80,0.22)"  : "rgba(248,81,73,0.22)",
    bottomColor: isUp ? "rgba(63,185,80,0.01)"  : "rgba(248,81,73,0.01)",
  });

  const seen = new Set<number>();
  const data = history
    .map((p) => ({
      time: Math.floor(new Date(p.recorded_at).getTime() / 1000) as import("lightweight-charts").Time,
      value: p.total_value,
    }))
    .sort((a, b) => (a.time as number) - (b.time as number))
    .filter((d) => {
      const t = d.time as number;
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });

  if (data.length > 0) {
    series.setData(data);
    chart.timeScale().fitContent();
  }
}

export default function PnLChart({ history }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  // Store latest history so we can apply it once the async chart init resolves
  const historyRef = useRef<HistoryPoint[]>(history);

  // Create chart once on mount — never recreated
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import("lightweight-charts").then(({ createChart, AreaSeries }) => {
      if (cancelled || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        autoSize: true,
        layout: {
          background: { color: "#0d1117" },
          textColor: "#7d8590",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#21262d" },
          horzLines: { color: "#21262d" },
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: "#21262d", textColor: "#7d8590" },
        timeScale: {
          borderColor: "#21262d",
          timeVisible: true,
          secondsVisible: false,
          fixRightEdge: true,
        },
        handleScale: false,
        handleScroll: false,
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor: "#3fb950",
        topColor:  "rgba(63,185,80,0.22)",
        bottomColor: "rgba(63,185,80,0.01)",
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: "#ecad0a",
        priceLineStyle: 2,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });

      chartRef.current  = chart;
      seriesRef.current = series;

      // Apply history that arrived before the chart was ready
      if (historyRef.current.length > 0) {
        applyHistoryToSeries(series, chart, historyRef.current);
      }
    });

    return () => {
      cancelled = true;
      chartRef.current?.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update series data whenever history changes — no chart recreate
  useEffect(() => {
    historyRef.current = history;
    if (seriesRef.current && chartRef.current && history.length > 0) {
      applyHistoryToSeries(seriesRef.current, chartRef.current, history);
    }
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full text-text-dim">
        <span className="text-2xl opacity-20">◈</span>
        <span className="text-[10px] font-mono uppercase tracking-widest">No history yet</span>
        <span className="text-[9px] font-mono text-text-dim/50">Snapshots every 30 s</span>
      </div>
    );
  }

  const first    = history[0].total_value;
  const last     = history[history.length - 1].total_value;
  const delta    = last - first;
  const deltaPct = (delta / first) * 100;
  const isUp     = delta >= 0;

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border-subtle shrink-0 text-[9px] font-mono overflow-x-auto">
        <span className="text-text-dim shrink-0">Start</span>
        <span className="text-text tabular-nums shrink-0">
          ${first.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
        <span className="text-border/40 shrink-0">│</span>
        <span className="text-text-dim shrink-0">Now</span>
        <span className="text-text tabular-nums font-semibold shrink-0">
          ${last.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
        <span className={`ml-auto shrink-0 tabular-nums font-bold px-1.5 py-0.5 rounded ${
          isUp
            ? "bg-up/10 text-up border border-up/25"
            : "bg-down/10 text-down border border-down/25"
        }`}>
          {isUp ? "+" : ""}{delta.toFixed(0)} ({isUp ? "+" : ""}{deltaPct.toFixed(2)}%)
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
