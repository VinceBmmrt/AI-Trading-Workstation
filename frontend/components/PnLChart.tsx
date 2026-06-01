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
  "use no memo";

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const historyRef = useRef<HistoryPoint[]>(history);

  // Create chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    // cancelled prevents the async import from creating a chart after cleanup
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, AreaSeries }) => {
      if (cancelled || !containerRef.current) return;

      const container = containerRef.current;

      const chart = createChart(container, {
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

      if (historyRef.current.length > 0) {
        applyHistoryToSeries(series, chart, historyRef.current);
      }

      // Force correct dimensions after layout settles
      function applySize() {
        if (cancelled) return;
        const r = container.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          chart.applyOptions({ width: r.width, height: r.height });
        }
      }
      requestAnimationFrame(applySize);
      setTimeout(applySize, 100); // belt-and-suspenders fallback

      ro = new ResizeObserver(applySize);
      ro.observe(container);
    });

    // IMPORTANT: set cancelled=true so the async import skips if cleanup ran first
    return () => {
      cancelled = true;
      ro?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current  = null;
        seriesRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update series data whenever history changes
  useEffect(() => {
    historyRef.current = history;
    if (seriesRef.current && chartRef.current && history.length > 0) {
      applyHistoryToSeries(seriesRef.current, chartRef.current, history);
    }
  }, [history]);

  const hasData  = history.length > 0;
  const first    = hasData ? history[0].total_value : 0;
  const last     = hasData ? history[history.length - 1].total_value : 0;
  const delta    = last - first;
  const deltaPct = first > 0 ? (delta / first) * 100 : 0;
  const isUp     = delta >= 0;

  // containerRef MUST always be in the DOM so useEffect(fn,[]) can mount the chart.
  // The empty-state message is an overlay when there's no data yet.
  return (
    <div className="flex flex-col h-full">
      {/* Stats bar — only visible once data arrives */}
      {hasData && (
        <div className="shrink-0 px-2 py-0.5 flex items-center gap-1.5 text-[8px] font-mono border-b border-border-subtle/50">
          <span className="text-text-dim">$10K→</span>
          <span className="text-text tabular-nums font-semibold">
            ${last.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          <span className={`ml-auto tabular-nums font-bold ${isUp ? "text-up" : "text-down"}`}>
            {isUp ? "+" : ""}{deltaPct.toFixed(2)}%
          </span>
        </div>
      )}
      {/* Chart container — always mounted so the useEffect can initialize LWC */}
      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="absolute inset-0" />
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-text-dim/40 uppercase tracking-widest">
            Awaiting snapshots…
          </div>
        )}
      </div>
    </div>
  );
}
