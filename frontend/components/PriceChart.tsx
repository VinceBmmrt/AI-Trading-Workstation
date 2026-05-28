"use client";

import { useEffect, useRef, useState } from "react";
import type { PriceUpdate } from "@/lib/types";
import { calcMA, calcRSI } from "@/lib/indicators";

interface Props {
  ticker: string;
  prices: Map<string, PriceUpdate>;
  history: Map<string, number[]>;
  volumeHistory: Map<string, number[]>;
}

type Range = "5m" | "15m" | "1H" | "4H" | "ALL";
const RANGE_SECS: Partial<Record<Range, number>> = { "5m": 300, "15m": 900, "1H": 3600, "4H": 14400 };

const CHART_THEME = {
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
    vertLine: { color: "#30363d", labelBackgroundColor: "#22272e" },
    horzLine: { color: "#30363d", labelBackgroundColor: "#22272e" },
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
};

export default function PriceChart({ ticker, prices, history, volumeHistory }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ma20Ref = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ma50Ref = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rsiChartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rsiSeriesRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);

  const [range, setRange] = useState<Range>("ALL");
  const [showMA, setShowMA] = useState(false);
  const [showVol, setShowVol] = useState(false);
  const [showRSI, setShowRSI] = useState(false);

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

  // Main chart creation — reruns only on ticker change
  useEffect(() => {
    if (!containerRef.current) return;
    let cleanup: (() => void) | undefined;

    import("lightweight-charts").then(({ createChart, AreaSeries, LineSeries, HistogramSeries }) => {
      if (!containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chart: any = createChart(containerRef.current, CHART_THEME);

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ma20Series: any = chart.addSeries(LineSeries, {
        color: "#ecad0a",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        visible: false,
        title: "MA20",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ma50Series: any = chart.addSeries(LineSeries, {
        color: "#753991",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        visible: false,
        title: "MA50",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const volSeries: any = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        priceLineVisible: false,
        lastValueVisible: false,
        visible: false,
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      chartRef.current = chart;
      seriesRef.current = series;
      ma20Ref.current = ma20Series;
      ma50Ref.current = ma50Series;
      volRef.current = volSeries;

      const hist = history.get(ticker) ?? [];
      if (hist.length > 0) {
        const now = Math.floor(Date.now() / 1000);
        const timeData = hist.map((v, i) => ({ time: now - (hist.length - 1 - i), value: v }));
        series.setData(timeData);

        const ma20Values = calcMA(hist, 20);
        const ma20Data = ma20Values
          .map((v, i) => v !== null ? { time: now - (hist.length - 1 - i), value: v as number } : null)
          .filter(Boolean);
        if (ma20Data.length > 0) ma20Series.setData(ma20Data);

        const ma50Values = calcMA(hist, 50);
        const ma50Data = ma50Values
          .map((v, i) => v !== null ? { time: now - (hist.length - 1 - i), value: v as number } : null)
          .filter(Boolean);
        if (ma50Data.length > 0) ma50Series.setData(ma50Data);

        const vols = volumeHistory.get(ticker) ?? [];
        if (vols.length > 0) {
          volSeries.setData(vols.map((v, i) => ({
            time: now - (vols.length - 1 - i),
            value: v,
            color: "rgba(32,157,215,0.25)",
          })));
        }

        lastTimeRef.current = now;
        applyRange(range);
      }

      // Apply current toggle state to newly created series
      ma20Series.applyOptions({ visible: showMA });
      ma50Series.applyOptions({ visible: showMA });
      volSeries.applyOptions({ visible: showVol });

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
        ma20Ref.current = null;
        ma50Ref.current = null;
        volRef.current = null;
      };
    });

    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  // RSI sub-chart — created/destroyed with showRSI toggle or ticker change
  useEffect(() => {
    if (!showRSI || !rsiContainerRef.current) return;
    let cleanup: (() => void) | undefined;

    import("lightweight-charts").then(({ createChart, LineSeries }) => {
      if (!rsiContainerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rsiChart: any = createChart(rsiContainerRef.current, {
        ...CHART_THEME,
        layout: { ...CHART_THEME.layout, fontSize: 10 },
        rightPriceScale: {
          borderColor: "#21262d",
          textColor: "#7d8590",
          autoScale: false,
          // @ts-expect-error -- lwc v5 accepts these on applyOptions below
          minValue: 0,
          maxValue: 100,
        },
        timeScale: { ...CHART_THEME.timeScale, visible: false },
        handleScale: { mouseWheel: false, pinch: false },
        handleScroll: { mouseWheel: false, pressedMouseMove: false },
      });

      rsiChart.priceScale("right").applyOptions({ autoScale: false });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rsiSeries: any = rsiChart.addSeries(LineSeries, {
        color: "#ecad0a",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      rsiSeries.createPriceLine({ price: 70, color: "#f85149", lineStyle: 2, lineWidth: 1, title: "OB" });
      rsiSeries.createPriceLine({ price: 50, color: "#7d8590", lineStyle: 2, lineWidth: 1 });
      rsiSeries.createPriceLine({ price: 30, color: "#3fb950", lineStyle: 2, lineWidth: 1, title: "OS" });

      rsiChartRef.current = rsiChart;
      rsiSeriesRef.current = rsiSeries;

      const hist = history.get(ticker) ?? [];
      const rsiValues = calcRSI(hist);
      const now = Math.floor(Date.now() / 1000);
      const rsiData = rsiValues
        .map((v, i) => v !== null ? { time: now - (hist.length - 1 - i), value: v as number } : null)
        .filter(Boolean);
      if (rsiData.length > 0) rsiSeries.setData(rsiData);

      const ro = new ResizeObserver(() => {
        if (rsiContainerRef.current) {
          rsiChart.applyOptions({
            width: rsiContainerRef.current.clientWidth,
            height: rsiContainerRef.current.clientHeight,
          });
        }
      });
      ro.observe(rsiContainerRef.current);

      cleanup = () => {
        ro.disconnect();
        rsiChart.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      };
    });

    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, showRSI]);

  // Toggle MA visibility
  useEffect(() => {
    ma20Ref.current?.applyOptions({ visible: showMA });
    ma50Ref.current?.applyOptions({ visible: showMA });
  }, [showMA]);

  // Toggle Volume visibility
  useEffect(() => {
    volRef.current?.applyOptions({ visible: showVol });
  }, [showVol]);

  // Live price updates
  useEffect(() => {
    if (!seriesRef.current) return;
    const update = prices.get(ticker);
    if (!update) return;
    const t = Math.floor(update.timestamp);
    const time = Math.max(t, lastTimeRef.current + 1);
    lastTimeRef.current = time;

    seriesRef.current.update({ time, value: update.price });

    // MA: recompute last value from history tail
    const hist = history.get(ticker) ?? [];
    if (hist.length >= 20 && ma20Ref.current) {
      const ma20 = hist.slice(-20).reduce((a, b) => a + b, 0) / 20;
      ma20Ref.current.update({ time, value: ma20 });
    }
    if (hist.length >= 50 && ma50Ref.current) {
      const ma50 = hist.slice(-50).reduce((a, b) => a + b, 0) / 50;
      ma50Ref.current.update({ time, value: ma50 });
    }

    // Volume
    if (volRef.current) {
      const vols = volumeHistory.get(ticker) ?? [];
      const lastVol = vols[vols.length - 1] ?? 0;
      const color = update.direction === "up"
        ? "rgba(63,185,80,0.4)"
        : "rgba(248,81,73,0.4)";
      volRef.current.update({ time, value: lastVol, color });
    }

    // RSI
    if (rsiSeriesRef.current && hist.length >= 15) {
      const rsiValues = calcRSI(hist);
      const lastRSI = rsiValues[rsiValues.length - 1];
      if (lastRSI !== null && lastRSI !== undefined) {
        rsiSeriesRef.current.update({ time, value: lastRSI });
      }
    }
  }, [ticker, prices]);  // eslint-disable-line react-hooks/exhaustive-deps

  const update = prices.get(ticker);
  const isUp = update?.direction === "up";
  const isDown = update?.direction === "down";

  const hist = history.get(ticker) ?? [];
  const open = hist[0];
  const sessionHigh = hist.length > 0 ? Math.max(...hist) : null;
  const sessionLow  = hist.length > 0 ? Math.min(...hist) : null;

  const toggleBtnClass = (active: boolean) =>
    `px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors border-l border-border cursor-pointer ${
      active
        ? "bg-accent/15 text-accent"
        : "text-text-dim hover:text-text hover:bg-surface-2"
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Chart header */}
      <div className="flex items-center gap-0 px-4 py-2 border-b border-border shrink-0 bg-surface overflow-x-auto">
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
        <div className="flex items-center gap-0 shrink-0 border border-border rounded overflow-hidden">
          {(["5m", "15m", "1H", "4H", "ALL"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => handleRange(r)}
              className={`px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors border-r border-border last:border-r-0 cursor-pointer ${
                range === r
                  ? "bg-accent/15 text-accent"
                  : "text-text-dim hover:text-text hover:bg-surface-2"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Indicator toggles */}
        <div className="flex items-center shrink-0 border border-border rounded overflow-hidden ml-2">
          <button onClick={() => setShowMA((v) => !v)} className={toggleBtnClass(showMA)} style={{ borderLeft: "none" }}>
            MA
          </button>
          <button onClick={() => setShowVol((v) => !v)} className={toggleBtnClass(showVol)}>
            VOL
          </button>
          <button onClick={() => setShowRSI((v) => !v)} className={toggleBtnClass(showRSI)}>
            RSI
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0" />

      {showRSI && (
        <div
          ref={rsiContainerRef}
          className="h-24 shrink-0 border-t border-border"
        />
      )}
    </div>
  );
}
