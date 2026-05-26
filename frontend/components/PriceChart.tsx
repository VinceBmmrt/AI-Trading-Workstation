"use client";

import { useEffect, useRef } from "react";
import type { PriceUpdate } from "@/lib/types";

interface Props {
  ticker: string;
  prices: Map<string, PriceUpdate>;
  history: Map<string, number[]>;
}

export default function PriceChart({ ticker, prices, history }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    let cleanup: (() => void) | undefined;

    import("lightweight-charts").then(({ createChart, AreaSeries }) => {
      if (!containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chart: any = createChart(containerRef.current, {
        layout: {
          background: { color: "#161b22" },
          textColor: "#7d8590",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1c2128", style: 1 },
          horzLines: { color: "#1c2128", style: 1 },
        },
        crosshair: {
          mode: 1,
          vertLine: { color: "#30363d", labelBackgroundColor: "#22272e" },
          horzLine: { color: "#30363d", labelBackgroundColor: "#22272e" },
        },
        rightPriceScale: {
          borderColor: "#21262d",
          textColor: "#7d8590",
        },
        timeScale: {
          borderColor: "#21262d",
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: false,
          fixRightEdge: false,
        },
        handleScale: { mouseWheel: true, pinch: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const series: any = chart.addSeries(AreaSeries, {
        lineColor: "#209dd7",
        topColor: "rgba(32, 157, 215, 0.18)",
        bottomColor: "rgba(32, 157, 215, 0.01)",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: "#209dd7",
        crosshairMarkerBackgroundColor: "#0d1117",
        priceLineVisible: true,
        priceLineColor: "#ecad0a",
        priceLineStyle: 2,
        priceLineWidth: 1,
        lastValueVisible: true,
        lastPriceAnimation: 1,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      // Seed with existing history
      const hist = history.get(ticker) ?? [];
      if (hist.length > 0) {
        const now = Math.floor(Date.now() / 1000);
        const seedData = hist.map((v, i) => ({
          time: now - (hist.length - 1 - i),
          value: v,
        }));
        series.setData(seedData);
        lastTimeRef.current = now;
      }

      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      ro.observe(containerRef.current);

      cleanup = () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      };
    });

    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  // Stream live price updates
  useEffect(() => {
    if (!seriesRef.current) return;
    const update = prices.get(ticker);
    if (!update) return;
    const t = Math.floor(update.timestamp);
    const time = Math.max(t, lastTimeRef.current + 1);
    lastTimeRef.current = time;
    seriesRef.current.update({ time, value: update.price });
  }, [ticker, prices]);

  const update = prices.get(ticker);
  const isUp = update?.direction === "up";
  const isDown = update?.direction === "down";

  return (
    <div className="flex flex-col h-full">
      {/* Chart header */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border shrink-0">
        <span className="font-mono font-bold text-accent text-sm tracking-wider uppercase">{ticker}</span>

        {update ? (
          <>
            <span className={`font-mono text-2xl font-semibold tabular-nums leading-none ${
              isUp ? "text-up" : isDown ? "text-down" : "text-text"
            }`}>
              ${update.price.toFixed(2)}
            </span>

            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono font-semibold tabular-nums ${
              isUp
                ? "bg-up/10 border border-up/25 text-up"
                : isDown
                ? "bg-down/10 border border-down/25 text-down"
                : "bg-surface-2 border border-border text-text-dim"
            }`}>
              <span>{isUp ? "▲" : isDown ? "▼" : "—"}</span>
              <span>{update.change >= 0 ? "+" : ""}{update.change.toFixed(2)}</span>
              <span className="opacity-70">({update.change_percent >= 0 ? "+" : ""}{update.change_percent.toFixed(2)}%)</span>
            </div>
          </>
        ) : (
          <span className="text-text-dim text-xs font-mono">Waiting for data…</span>
        )}
      </div>

      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
