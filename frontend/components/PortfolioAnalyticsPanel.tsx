"use client";

import type { PortfolioAnalytics } from "@/lib/types";

interface Props {
  analytics: PortfolioAnalytics | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean | null;
}

function MetricCard({ label, value, sub, positive }: MetricCardProps) {
  const valueColor =
    positive === true ? "text-green" :
    positive === false ? "text-red" :
    "text-text";

  return (
    <div className="bg-surface border border-border rounded p-3 flex flex-col gap-1">
      <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-mono font-semibold tabular-nums ${valueColor}`}>{value}</span>
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

export default function PortfolioAnalyticsPanel({ analytics }: Props) {
  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-xs font-mono">
        Loading analytics…
      </div>
    );
  }

  const a = analytics;

  return (
    <div className="p-4 grid grid-cols-3 gap-3 content-start overflow-auto h-full">
      <MetricCard
        label="Total Return"
        value={fmtPct(a.total_return_pct)}
        sub={`${a.total_trades} trade${a.total_trades !== 1 ? "s" : ""}`}
        positive={a.total_return_pct >= 0 ? true : false}
      />
      <MetricCard
        label="Realized P&L"
        value={fmtPnl(a.realized_pnl)}
        sub={`${a.buy_count}B / ${a.sell_count}S`}
        positive={a.realized_pnl >= 0 ? true : false}
      />
      <MetricCard
        label="Unrealized P&L"
        value={fmtPnl(a.unrealized_pnl)}
        sub="open positions"
        positive={a.unrealized_pnl >= 0 ? true : false}
      />
      <MetricCard
        label="Win Rate"
        value={`${a.win_rate.toFixed(1)}%`}
        sub="closed positions"
        positive={a.win_rate >= 50 ? true : a.win_rate > 0 ? null : false}
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
  );
}
