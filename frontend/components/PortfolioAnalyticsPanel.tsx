"use client";

import type { PortfolioAnalytics, Portfolio } from "@/lib/types";

interface Props {
  analytics: PortfolioAnalytics | null;
  portfolio?: Portfolio | null;
}

/** Sector classification for known tickers */
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

const SECTOR_COLORS: Record<string, string> = {
  TECH: "#209dd7",
  SEMI: "#753991",
  AUTO: "#ecad0a",
  FIN: "#3fb950",
  MEDIA: "#f85149",
  RETAIL: "#58a6ff",
  PHARMA: "#79c0ff",
  ENERGY: "#d29922",
  INDUS: "#8b949e",
  OTHER: "#484f58",
};

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean | null;
  large?: boolean;
}

function MetricCard({ label, value, sub, positive, large }: MetricCardProps) {
  const valueColor =
    positive === true ? "text-up" :
    positive === false ? "text-down" :
    "text-text";

  return (
    <div className="bg-surface border border-border rounded p-3 flex flex-col gap-1">
      <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest leading-none">{label}</span>
      <span className={`${large ? "text-[15px]" : "text-sm"} font-mono font-semibold tabular-nums ${valueColor} leading-tight mt-0.5`}>
        {value}
      </span>
      {sub && <span className="text-[10px] font-mono text-text-dim">{sub}</span>}
    </div>
  );
}

function fmtPnl(v: number) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

/** Compute sector allocation percentages from portfolio positions */
function computeSectorBreakdown(portfolio: Portfolio | null | undefined): { sector: string; pct: number; value: number }[] {
  if (!portfolio || portfolio.positions.length === 0) return [];

  const totals: Record<string, number> = {};
  let totalValue = 0;

  for (const pos of portfolio.positions) {
    const sector = SECTOR_MAP[pos.ticker] ?? "OTHER";
    totals[sector] = (totals[sector] ?? 0) + pos.current_value;
    totalValue += pos.current_value;
  }

  if (totalValue === 0) return [];

  return Object.entries(totals)
    .map(([sector, value]) => ({ sector, value, pct: (value / totalValue) * 100 }))
    .sort((a, b) => b.pct - a.pct);
}

export default function PortfolioAnalyticsPanel({ analytics, portfolio }: Props) {
  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-xs font-mono">
        Loading analytics…
      </div>
    );
  }

  const a = analytics;
  const sectors = computeSectorBreakdown(portfolio);

  return (
    <div className="p-4 flex flex-col gap-4 overflow-auto h-full">
      {/* Metrics grid — 2 columns */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Total Return"
          value={fmtPct(a.total_return_pct)}
          sub={`${a.total_trades} trade${a.total_trades !== 1 ? "s" : ""}`}
          positive={a.total_return_pct >= 0}
          large
        />
        <MetricCard
          label="Win Rate"
          value={`${a.win_rate.toFixed(1)}%`}
          sub="closed positions"
          positive={a.win_rate >= 50 ? true : a.win_rate > 0 ? null : false}
          large
        />
        <MetricCard
          label="Realized P&L"
          value={fmtPnl(a.realized_pnl)}
          sub={`${a.buy_count}B / ${a.sell_count}S`}
          positive={a.realized_pnl >= 0}
        />
        <MetricCard
          label="Unrealized P&L"
          value={fmtPnl(a.unrealized_pnl)}
          sub="open positions"
          positive={a.unrealized_pnl >= 0}
        />
        <MetricCard
          label="Best Performer"
          value={a.best_performer ?? "—"}
          positive={a.best_performer ? true : null}
        />
        <MetricCard
          label="Worst Performer"
          value={a.worst_performer ?? "—"}
          positive={a.worst_performer ? false : null}
        />
      </div>

      {/* Sector Breakdown — CSS bar chart */}
      {sectors.length > 0 && (
        <div className="bg-surface border border-border rounded p-3 flex flex-col gap-2">
          <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest leading-none">
            Sector Allocation
          </span>
          <div className="flex flex-col gap-1.5 mt-1">
            {sectors.map(({ sector, pct }) => {
              const color = SECTOR_COLORS[sector] ?? SECTOR_COLORS.OTHER;
              return (
                <div key={sector} className="flex items-center gap-2">
                  <span className="w-12 text-[9px] font-mono text-text-dim shrink-0 text-right">{sector}</span>
                  <div className="flex-1 h-3 bg-surface-2 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.8 }}
                    />
                  </div>
                  <span className="w-10 text-[9px] font-mono tabular-nums text-text-dim shrink-0">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
