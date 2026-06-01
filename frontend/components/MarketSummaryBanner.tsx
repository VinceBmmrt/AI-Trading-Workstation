"use client";

/**
 * MarketSummaryBanner — professional market status bar.
 * Self-contained, no props required. No changes needed to page.tsx call site.
 */

function getMarketSession(): { label: string; color: string } {
  const now = new Date();
  // Approximate Eastern Time (UTC-5; ignores DST for simplicity)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const est = new Date(utc + -5 * 3600000);
  const h = est.getHours();
  const m = est.getMinutes();
  const totalMin = h * 60 + m;
  const day = est.getDay(); // 0 Sun, 6 Sat

  if (day === 0 || day === 6) return { label: "WEEKEND — CLOSED", color: "var(--color-text-dim)" };
  if (totalMin >= 9 * 60 + 30 && totalMin < 16 * 60) return { label: "MARKET OPEN", color: "var(--color-up)" };
  if (totalMin >= 4 * 60 && totalMin < 9 * 60 + 30) return { label: "PRE-MARKET", color: "var(--color-accent)" };
  if (totalMin >= 16 * 60 && totalMin < 20 * 60) return { label: "AFTER-HOURS", color: "var(--color-blue)" };
  return { label: "MARKET CLOSED", color: "var(--color-text-dim)" };
}

const INFO_BADGES = [
  { label: "PAPER TRADING", color: "var(--color-accent)" },
  { label: "GBM SIMULATOR", color: "var(--color-blue)" },
  { label: "NO FEES · INSTANT FILL", color: "var(--color-text-dim)" },
] as const;

export default function MarketSummaryBanner() {
  const session = getMarketSession();

  return (
    <div className="flex items-center gap-3 px-4 h-7 border-b border-border bg-surface shrink-0 overflow-hidden select-none">
      {/* Session indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: session.color }}
        />
        <span
          className="text-[9px] font-mono font-bold uppercase tracking-widest"
          style={{ color: session.color }}
        >
          {session.label}
        </span>
      </div>

      <span className="text-border/50 shrink-0">│</span>

      {/* Info badges */}
      <div className="flex items-center gap-3 overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
        {INFO_BADGES.map((b) => (
          <span
            key={b.label}
            className="text-[9px] font-mono font-semibold uppercase tracking-widest shrink-0"
            style={{ color: b.color }}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right label */}
      <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest shrink-0">
        Finance Ally · AI Trading Workstation
      </span>
    </div>
  );
}
