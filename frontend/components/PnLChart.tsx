"use client";

import { useEffect, useRef } from "react";
import type { HistoryPoint } from "@/lib/types";

interface Props {
  history: HistoryPoint[];
}

export default function PnLChart({ history }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || history.length === 0) return;

    import("lightweight-charts").then(({ createChart, AreaSeries }) => {
      if (!containerRef.current) return;

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const chart = createChart(containerRef.current, {
        layout: { background: { color: "#161b22" }, textColor: "#8b949e" },
        grid: { vertLines: { color: "#21262d" }, horzLines: { color: "#21262d" } },
        rightPriceScale: { borderColor: "#30363d" },
        timeScale: { borderColor: "#30363d", timeVisible: true },
        handleScale: false,
        handleScroll: false,
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor: "#ecad0a",
        topColor: "rgba(236, 173, 10, 0.3)",
        bottomColor: "rgba(236, 173, 10, 0.0)",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const data = history.map((p) => ({
        time: Math.floor(new Date(p.recorded_at).getTime() / 1000) as import("lightweight-charts").Time,
        value: p.total_value,
      }));

      series.setData(data);
      chartRef.current = chart;
      seriesRef.current = series;

      const ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      containerRef.current && ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        chart.remove();
      };
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-xs font-mono">
        NO HISTORY YET
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
