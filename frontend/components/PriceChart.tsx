"use client";

import { useEffect, useRef, useState } from "react";
import type { PriceUpdate } from "@/lib/types";

interface Props {
  ticker: string;
  prices: Map<string, PriceUpdate>;
  history: Map<string, number[]>;
}

type Range = "5m" | "15m" | "1H" | "4H" | "ALL";
const RANGE_SECS: Partial<Record<Range, number>> = { "5m": 300, "15m": 900, "1H": 3600, "4H": 14400 };

export default function PriceChart({ ticker, prices, history }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);
  const [range, setRange] = useState<Range>("ALL");

  // Apply visible range without recreating chart
  function applyRange(r: Range) {
    if (!chartRef.current) return;
    if (r === "ALL") {
      chartRef.current.timeScale().fitContent();
    } else {
      const secs = RANGE_SECS[r]!;
      const now = Math.floor(Date.now() / 1000);
      try {
        chartRef.current.timeScale().setVisibleRange({ from: now - secs, to: now + 10 });
      } catch {
        chartRef.current.timeScale().fitContent();
      }
    }
  }

  function handleRange(r: Range) {
    setRange(r);
    applyRange(r);
  }

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
          vertLines: { color: "#1c2128" },
          horzLines: { color: "#1c2128" },
        },
        crosshair: {
          mode: 1,
          vertLine: { color: "#30363d", width: 1, labelBackgroundColor: "#22272e" },
          horzLine: { color: "#30363d", width: 1, labelBackgroundColor: "#22272e" },
        },
        rightPriceScale: { borderColor: "#21262d", textColor: "#7d8590" },
        timeScale: {
          borderColor: "#21262d",
          timeVisible: true,
          secondsVisible: true,
          fixRightEdge: true,
        },
        handleScale: { mouseWheel: true, pinch: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const series: any = chart.addSeries(AreaSeries, {
        lineColor: "#209dd7",
        topColor: "rgba(32,157,215,0.22)",
        bottomColor: "rgba(32,157,215,0.01)",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: "#209dd7",
        crosshairMarkerBackgroundColor: "#0d1117",
        priceLineVisible: true,
        priceLineColor: "#ecad0a",
        priceLineStyle: 2,
        lastValueVisible: true,
        lastPriceAnimation: 1,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const hist = history.get(ticker) ?? [];
      if (hist.length > 0) {
        const now = Math.floor(Date.now() / 1000);
        series.setData(hist.map((v, i) => ({ time: now - (hist.length - 1 - i), value: v })));
        lastTimeRef.current = now;
        applyRange(range);
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

  // Stream live updates
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

  const hist = history.get(ticker) ?? [];
  const open = hist[0];
  const sessionHigh = hist.length > 0 ? Math.max(...hist) : null;
  const sessionLow  = hist.length > 0 ? Math.min(...hist) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Chart header */}
      <div className="flex items-center gap-0 px-4 py-2 border-b border-border shrink-0 bg-surface">
        {/* Ticker + price */}
        <div className="flex items-baseline gap-3 flex-1 min-w-0">
          <span className="font-mono font-bold text-accent text-[13px] tracking-[0.12em] uppercase shrink-0">
            {ticker}
          </span>
          {update ? (
            <>
              <span className={`font-mono text-[22px] font-semibold tabular-nums leading-none ${
                isUp ? "text-up" : isDown ? "text-down" : "text-text"
              }`}>
                ${update.price.toFixed(2)}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold tabular-nums shrink-0 ${
                isUp
                  ? "bg-up/10 border border-up/25 text-up"
                  : isDown
                  ? "bg-down/10 border border-down/25 text-down"
                  : "bg-surface-2 border border-border text-text-dim"
              }`}>
                {isUp ? "▲" : isDown ? "▼" : "—"}
                &nbsp;{update.change >= 0 ? "+" : ""}{update.change.toFixed(2)}
                &nbsp;<span className="opacity-75">({update.change_percent >= 0 ? "+" : ""}{update.change_percent.toFixed(2)}%)</span>
              </span>
            </>
          ) : (
            <span className="text-text-dim text-xs font-mono animate-pulse">Connecting…</span>
          )}
        </div>

        {/* OHLC mini stats */}
        {open && sessionHigh && sessionLow && (
          <div className="hidden lg:flex items-center gap-4 mr-4 text-[10px] font-mono tabular-nums shrink-0">
            <div>
              <span className="text-text-dim mr-1">O</span>
              <span className="text-text">${open.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-dim mr-1">H</span>
              <span className="text-up">${sessionHigh.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-dim mr-1">L</span>
              <span className="text-down">${sessionLow.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Time range selector */}
        <div className="flex items-center gap-0.5 shrink-0 border border-border rounded overflow-hidden">
          {(["5m", "15m", "1H", "4H", "ALL"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => handleRange(r)}
              className={`px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors border-r border-border last:border-r-0 ${
                range === r
                  ? "bg-accent/15 text-accent"
                  : "text-text-dim hover:text-text hover:bg-surface-2"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
