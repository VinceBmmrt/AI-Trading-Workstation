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

    import("lightweight-charts").then(({ createChart, LineSeries }) => {
      if (!containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chart: any = createChart(containerRef.current, {
        layout: { background: { color: "#161b22" }, textColor: "#8b949e" },
        grid: { vertLines: { color: "#21262d" }, horzLines: { color: "#21262d" } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: "#30363d" },
        timeScale: { borderColor: "#30363d", timeVisible: true, secondsVisible: false },
        handleScale: { mouseWheel: true, pinch: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const series: any = chart.addSeries(LineSeries, {
        color: "#209dd7",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        priceLineVisible: true,
        priceLineColor: "#ecad0a",
        priceLineStyle: 2,
        lastValueVisible: true,
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
      <div className="flex items-baseline gap-3 px-4 py-2 border-b border-border shrink-0">
        <span className="font-mono font-semibold text-accent">{ticker}</span>
        {update && (
          <>
            <span className={`font-mono text-xl font-semibold tabular-nums ${isUp ? "text-up" : isDown ? "text-down" : "text-text"}`}>
              ${update.price.toFixed(2)}
            </span>
            <span className={`font-mono text-sm tabular-nums ${isUp ? "text-up" : isDown ? "text-down" : "text-text-dim"}`}>
              {update.change >= 0 ? "+" : ""}{update.change.toFixed(2)}
              {" "}({update.change_percent >= 0 ? "+" : ""}{update.change_percent.toFixed(2)}%)
              {" "}{isUp ? "▲" : isDown ? "▼" : "—"}
            </span>
          </>
        )}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
