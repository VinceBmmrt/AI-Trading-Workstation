# Phase 8: Trade History & Portfolio Analytics — Research

**Researched:** 2026-05-27
**Phase:** 8 — Trade History & Portfolio Analytics

---

## Summary

Phase 8 adds two new portfolio panel tabs (History + Analytics) backed by a new backend trades endpoint and a client-side CSV export. The core data already exists in the `trades` SQLite table. The main work is building the API layer, computing the analytics metrics, and wiring up 2 new frontend components.

---

## Existing Code Inventory

### Backend

| File | Relevance |
|------|-----------|
| `backend/app/routes/portfolio.py` | Add new routes here: `GET /api/portfolio/trades`, `GET /api/portfolio/analytics` |
| `backend/app/db.py` | `execute_trade()` inserts into `trades` table; no avg_cost stored per trade |
| SQLite `trades` schema | `id, user_id, ticker, side, quantity, price, executed_at` — no realized P&L column |
| SQLite `positions` schema | `ticker, quantity, avg_cost` — current avg_cost only (not historical per trade) |

### Frontend

| File | Relevance |
|------|-----------|
| `frontend/app/page.tsx` | Portfolio tab state (`portfolioTab`) — add "history" and "analytics" tabs |
| `frontend/components/PositionsTable.tsx` | Pattern for terminal-style data table |
| `frontend/components/PnLChart.tsx` | Pattern for portfolio panel tab content |
| `frontend/lib/api.ts` | Add `fetchTrades()` and `fetchAnalytics()` calls |
| `frontend/lib/types.ts` | Add `TradeRecord` and `PortfolioAnalytics` interfaces |

---

## Architecture Decisions

### 1. Trade History Endpoint

**Decision:** `GET /api/portfolio/trades` returns all trades from the `trades` table, ordered newest-first. No per-trade realized P&L stored — the trade table has no avg_cost field.

**Response shape:**
```json
[
  {
    "id": "uuid",
    "ticker": "AAPL",
    "side": "buy",
    "quantity": 10,
    "price": 189.55,
    "total": 1895.50,
    "executed_at": "2026-05-27T09:00:00Z"
  }
]
```

`total = quantity × price` computed server-side. This is the raw trade log — realized P&L is not tracked per-trade because avg_cost is not stored historically.

### 2. Portfolio Analytics Endpoint

**Decision:** `GET /api/portfolio/analytics` computes all metrics server-side in a single SQL + Python pass.

**Metrics to compute:**

| Metric | Formula |
|--------|---------|
| `total_trades` | `COUNT(*)` from trades table |
| `total_invested` | `SUM(quantity × price)` WHERE side='buy' |
| `total_received` | `SUM(quantity × price)` WHERE side='sell' |
| `realized_pnl` | `total_received - total_invested_in_sold` — see note below |
| `unrealized_pnl` | `sum(qty × current_price - qty × avg_cost)` across open positions |
| `total_return_pct` | `(total_value - 10000) / 10000 × 100` |
| `best_performer` | Position with highest `pnl_percent` |
| `worst_performer` | Position with lowest `pnl_percent` |
| `win_rate` | % of SELL trades where `sell_price > position.avg_cost` (current avg_cost approximation) |

**Realized P&L note:** Because avg_cost at time of sale is not stored, we approximate:
- `realized_pnl = total_received - (sells.quantity_total × current_avg_cost)`
- This is an approximation that works well for a simulator where positions are usually built up uniformly. For the purposes of this project, it's accurate enough.
- Alternative (simpler): `realized_pnl = (starting_capital + total_received - total_invested) - current_cash_balance` — exact accounting identity for this single-user system.

**Exact realized P&L formula:** `realized_pnl = cash_balance - starting_capital - (total_invested - total_received)` which equals `cash_balance - 10000 + net_sold_proceeds`. This is exact and requires no avg_cost tracking.

**Response shape:**
```json
{
  "total_trades": 42,
  "total_invested": 15000.00,
  "total_received": 8000.00,
  "realized_pnl": 350.00,
  "unrealized_pnl": 436.90,
  "total_return_pct": 7.87,
  "best_performer": {"ticker": "NVDA", "pnl_percent": 28.01},
  "worst_performer": {"ticker": "AAPL", "pnl_percent": -0.20},
  "win_rate": 66.7,
  "buy_count": 28,
  "sell_count": 14
}
```

### 3. CSV Export

**Decision:** Client-side CSV generation using `Blob` + `URL.createObjectURL` + programmatic `<a>` click. No backend endpoint needed — the trades data is already fetched from the API.

```typescript
function exportToCsv(trades: TradeRecord[]) {
  const header = "Date,Ticker,Side,Quantity,Price,Total\n";
  const rows = trades.map(t =>
    `${t.executed_at},${t.ticker},${t.side},${t.quantity},${t.price},${t.total}`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "trades.csv";
  a.click();
  URL.revokeObjectURL(url);
}
```

This works in all browsers without a backend endpoint and in Next.js static export.

### 4. Frontend Tab Layout

**Current tabs:** Positions | Heatmap | P&L (3 tabs)
**After Phase 8:** Positions | Heatmap | P&L | History | Analytics (5 tabs)

The tab bar at `frontend/app/page.tsx:96` uses a `flex` layout with `px-4 py-2` buttons. 5 tabs fit comfortably at desktop width. At tablet (768px) the tab labels may need to be shortened:
- "Positions" → "POS"
- "Heatmap" → "MAP"
- "P&L" → "P&L" (keep)
- "History" → "HIST"
- "Analytics" → "STATS"

Or keep full labels and allow horizontal scroll on the tab bar. The tab bar already uses `overflow` from the parent.

### 5. Analytics Cards Layout

Analytics cards should match the terminal aesthetic — compact metric blocks similar to the Header component. Use a 2×3 or 3×2 grid:

```
┌──────────────┬──────────────┬──────────────┐
│ Total Return │ Realized P&L │ Unrealized   │
│   +7.87%     │  +$350.00    │   +$436.90   │
├──────────────┼──────────────┼──────────────┤
│  Win Rate    │ Best Ticker  │ Worst Ticker │
│   66.7%      │ NVDA +28%    │ AAPL -0.2%   │
└──────────────┴──────────────┴──────────────┘
```

Plus a trade count summary: "42 trades · 28 buys · 14 sells"

### 6. Hook / Data Fetching Strategy

**Decision:** Add `fetchTrades` and `fetchAnalytics` to `api.ts`. Fetch both in `usePortfolio` hook OR create a new `useTrades` hook. Given that analytics update on every price tick (unrealized P&L), fetching analytics from the backend on every tick is expensive.

**Better approach:**
- `trades` data: fetch once on mount + refresh after each trade (static data)
- `analytics` data: compute `unrealized_pnl` and `best/worst_performer` client-side from the existing `portfolio` prop (already live), fetch `realized_pnl`, `win_rate`, `total_trades` etc. once from backend on mount + after each trade

This avoids polling the analytics endpoint on every SSE tick.

---

## Validation Architecture

| Concern | Validation approach |
|---------|---------------------|
| Trade history accuracy | Compare DB row count vs displayed trades; verify newest-first ordering |
| Realized P&L formula | Manual calculation: (cash - 10k + net_sold_proceeds) should match displayed value |
| Win rate calculation | Execute a known-win sell (sell above avg_cost), verify win_rate increases |
| CSV export | Trigger export, verify download occurs, spot-check row count vs displayed table |
| Analytics live update | Execute a trade, verify trade count +1 and analytics refresh |
| Tab layout | Verify all 5 tabs visible and render correctly at 768px+ viewport |

---

## Files to Create / Modify

### Backend
- `backend/app/routes/portfolio.py` — Add `GET /api/portfolio/trades` and `GET /api/portfolio/analytics` routes

### Frontend
- `frontend/lib/types.ts` — Add `TradeRecord` and `PortfolioAnalytics` interfaces
- `frontend/lib/api.ts` — Add `fetchTrades()` and `fetchAnalytics()` functions
- `frontend/app/page.tsx` — Add "history" and "analytics" to `PortfolioTab` type + tab bar
- `frontend/components/TradeHistory.tsx` — New component: trade log table with CSV export button
- `frontend/components/PortfolioAnalytics.tsx` — New component: analytics cards grid
- `frontend/hooks/usePortfolio.ts` — Add trades + analytics fetching (or new hook)

---

## Risk / Gotchas

1. **Win rate approximation**: Using current avg_cost for historical sells is an approximation. If the user buys more shares after a sell, the avg_cost changes. This is acceptable for a simulator.
2. **CSV in static export**: `URL.createObjectURL` is client-only — will not work during SSR. Wrap in `useEffect` or add `typeof window !== 'undefined'` guard.
3. **5-tab overflow on narrow screens**: At 768px with chat collapsed, the tab bar has ~534px for 5 tabs. Each tab with `px-4` padding = ~60-80px. Total ~350-400px for 5 tabs — fits fine. Monitor at smaller sizes.
4. **Analytics on every SSE tick**: Don't call `/api/portfolio/analytics` on every price update. Use a debounced approach or derive live values (unrealized P&L) client-side from the portfolio prop.

## RESEARCH COMPLETE
