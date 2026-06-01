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
type ChartType = "line" | "area" | "candle";

const RANGE_SECS: Partial<Record<Range, number>> = { "5m": 300, "15m": 900, "1H": 3600, "4H": 14400 };

/** Sector labels for known tickers */
const SECTOR_MAP: Record<string, string> = {
  AAPL: "TECH", GOOGL: "TECH", MSFT: "TECH", AMZN: "TECH",
  TSLA: "AUTO", NVDA: "SEMI", META: "TECH", NFLX: "MEDIA",
  JPM: "FIN", V: "FIN", BAC: "FIN", GS: "FIN",
  DIS: "MEDIA", PYPL: "FIN", UBER: "TECH", LYFT: "TECH",
  SNAP: "MEDIA", AMD: "SEMI", INTC: "SEMI",
  CRM: "TECH", ORCL: "TECH", IBM: "TECH", QCOM: "SEMI",
  WMT: "RETAIL", TGT: "RETAIL", HD: "RETAIL", COST: "RETAIL",
  PFE: "PHARMA", JNJ: "PHARMA", MRNA: "PHARMA",
  XOM: "ENERGY", CVX: "ENERGY", BA: "INDUS",
};

const CHART_THEME = {
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

/** Generate fake OHLCV bar from a close price and the previous close */
function makeCandle(time: number, close: number, prevClose: number, direction: "up" | "down" | "flat") {
  const open = prevClose;
  const spread = close * 0.002; // ±0.2% spread for high/low
  const high = Math.max(open, close) + Math.abs(spread * (0.5 + Math.random() * 0.5));
  const low  = Math.min(open, close) - Math.abs(spread * (0.5 + Math.random() * 0.5));
  const volume = Math.floor(50_000 + Math.random() * 450_000);
  return { time, open, high, low, close, volume, direction };
}

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
  // Store candle history for incremental updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleHistRef = useRef<any[]>([]);

  const [range, setRange] = useState<Range>("ALL");
  const [showMA, setShowMA] = useState(false);
  const [showVol, setShowVol] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("area");

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

  // Main chart — recreated when ticker OR chartType changes
  useEffect(() => {
    if (!containerRef.current) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    import("lightweight-charts").then(({
      createChart,
      AreaSeries,
      LineSeries,
      CandlestickSeries,
      HistogramSeries,
    }) => {
      if (cancelled || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chart: any = createChart(containerRef.current, CHART_THEME);

      const hist = history.get(ticker) ?? [];
      const now = Math.floor(Date.now() / 1000);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let series: any;

      if (chartType === "area") {
        series = chart.addSeries(AreaSeries, {
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
        if (hist.length > 0) {
          series.setData(hist.map((v, i) => ({ time: now - (hist.length - 1 - i), value: v })));
        }
      } else if (chartType === "line") {
        series = chart.addSeries(LineSeries, {
          color: "#209dd7",
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          priceLineVisible: true,
          priceLineColor: "#ecad0a",
          priceLineStyle: 2,
          lastValueVisible: true,
          lastPriceAnimation: 1,
        });
        if (hist.length > 0) {
          series.setData(hist.map((v, i) => ({ time: now - (hist.length - 1 - i), value: v })));
        }
      } else {
        // Candlestick
        series = chart.addSeries(CandlestickSeries, {
          upColor: "#3fb950",
          downColor: "#f85149",
          borderUpColor: "#3fb950",
          borderDownColor: "#f85149",
          wickUpColor: "#3fb950",
          wickDownColor: "#f85149",
        });
        if (hist.length > 0) {
          const candles = hist.map((close, i) => {
            const prevClose = i === 0 ? close : hist[i - 1];
            const t = now - (hist.length - 1 - i);
            return makeCandle(t, close, prevClose, close >= prevClose ? "up" : "down");
          });
          candleHistRef.current = candles;
          series.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
        }
      }

      // MA series (shared across chart types, overlaid on price pane)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ma20Series: any = chart.addSeries(LineSeries, {
        color: "#ecad0a",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        visible: showMA,
        title: "MA20",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ma50Series: any = chart.addSeries(LineSeries, {
        color: "#753991",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        visible: showMA,
        title: "MA50",
      });

      if (hist.length > 0) {
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
      }

      // Volume histogram
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const volSeries: any = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        priceLineVisible: false,
        lastValueVisible: false,
        visible: showVol,
      });
      volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

      const vols = volumeHistory.get(ticker) ?? [];
      if (vols.length > 0) {
        volSeries.setData(vols.map((v, i) => ({
          time: now - (vols.length - 1 - i),
          value: v,
          color: "rgba(32,157,215,0.25)",
        })));
      }

      chartRef.current = chart;
      seriesRef.current = series;
      ma20Ref.current = ma20Series;
      ma50Ref.current = ma50Series;
      volRef.current = volSeries;

      if (hist.length > 0) {
        lastTimeRef.current = now;
        applyRange(range);
      }

      cleanup = () => {
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
        ma20Ref.current = null;
        ma50Ref.current = null;
        volRef.current = null;
        candleHistRef.current = [];
      };
    });

    return () => { cancelled = true; cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, chartType]);

  // RSI sub-chart — created/destroyed with showRSI toggle or ticker change
  useEffect(() => {
    if (!showRSI || !rsiContainerRef.current) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    import("lightweight-charts").then(({ createChart, LineSeries }) => {
      if (cancelled || !rsiContainerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rsiChart: any = createChart(rsiContainerRef.current, {
        ...CHART_THEME,
        layout: { ...CHART_THEME.layout, fontSize: 10 },
        rightPriceScale: {
          borderColor: "#21262d",
          textColor: "#7d8590",
          autoScale: false,
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

      cleanup = () => {
        rsiChart.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      };
    });

    return () => { cancelled = true; cleanup?.(); };
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

    if (chartType === "candle") {
      const prevClose = candleHistRef.current.length > 0
        ? candleHistRef.current[candleHistRef.current.length - 1].close
        : update.previous_price;
      const candle = makeCandle(time, update.price, prevClose, update.direction);
      candleHistRef.current.push(candle);
      seriesRef.current.update({ time: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close });
    } else {
      seriesRef.current.update({ time, value: update.price });
    }

    // MA updates
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
      const color = update.direction === "up" ? "rgba(63,185,80,0.4)" : "rgba(248,81,73,0.4)";
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
  }, [ticker, prices]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = prices.get(ticker);
  const isUp = update?.direction === "up";
  const isDown = update?.direction === "down";

  const hist = history.get(ticker) ?? [];
  const open = hist[0];
  const sessionHigh = hist.length > 0 ? Math.max(...hist) : null;
  const sessionLow  = hist.length > 0 ? Math.min(...hist) : null;
  const sector = SECTOR_MAP[ticker];

  const toggleBtnClass = (active: boolean) =>
    `px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors border-l border-border cursor-pointer ${
      active
        ? "bg-accent/15 text-accent"
        : "text-text-dim hover:text-text hover:bg-surface-2"
    }`;

  const chartTypeBtnClass = (type: ChartType) =>
    `px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors border-r border-border last:border-r-0 cursor-pointer ${
      chartType === type
        ? "bg-blue/15 text-blue"
        : "text-text-dim hover:text-text hover:bg-surface-2"
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Chart header */}
      <div className="flex items-center gap-0 px-4 py-2 border-b border-border shrink-0 bg-surface min-w-0">
        {/* Ticker + sector + price */}
        <div className="flex items-baseline gap-3 flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono font-bold text-accent text-[13px] tracking-[0.12em] uppercase">
              {ticker}
            </span>
            {sector && (
              <span className="text-[9px] font-mono text-text-dim/60 border border-border/50 rounded px-1 py-px leading-none tracking-wider">
                {sector}
              </span>
            )}
          </div>
          {update ? (
            <>
              <span className={`font-mono text-[22px] font-semibold tabular-nums leading-none shrink-0 ${
                isUp ? "text-up" : isDown ? "text-down" : "text-text"
              }`}>
                ${update.price.toFixed(2)}
              </span>
              <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold tabular-nums shrink-0 ${
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

        {/* OHLC mini stats — only when plenty of space */}
        {open && sessionHigh && sessionLow && (
          <div className="hidden xl:flex items-center gap-4 mr-4 text-[10px] font-mono tabular-nums shrink-0">
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

        {/* Toolbar: chart type + time range + indicators */}
        <div className="flex items-center gap-2 shrink-0 ml-2 overflow-x-auto">
          {/* Chart type: L / A / C */}
          <div className="flex items-center shrink-0 border border-border rounded overflow-hidden">
            {(["line", "area", "candle"] as ChartType[]).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={chartTypeBtnClass(t)}
                title={{ line: "Line", area: "Area", candle: "Candlestick" }[t]}
              >
                {t === "line" ? "L" : t === "area" ? "A" : "C"}
              </button>
            ))}
          </div>

          {/* Time range */}
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
          <div className="flex items-center shrink-0 border border-border rounded overflow-hidden">
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
      </div>

      <div ref={containerRef} className="flex-1 min-h-0" />

      {showRSI && (
        <div ref={rsiContainerRef} className="h-24 shrink-0 border-t border-border" />
      )}
    </div>
  );
}
