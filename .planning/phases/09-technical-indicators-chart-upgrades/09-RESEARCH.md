# Phase 9: Technical Indicators & Chart Upgrades — Research

**Researched:** 2026-05-28
**Phase:** 9 — Technical Indicators & Chart Upgrades

---

## Summary

Phase 9 upgrades `PriceChart.tsx` with toggleable technical overlays: MA20/MA50 line overlays, Volume histogram, and RSI(14) sub-panel. All indicator math is computed client-side from existing price history. The backend requires no changes. lightweight-charts v5.2.0 provides native multi-pane support via `chart.addPane()` and `chart.addSeries(type, opts, paneIndex)`, making this entirely a frontend exercise.

---

## Existing Code Inventory

| File | Relevance |
|------|-----------|
| `frontend/components/PriceChart.tsx` | Main target — extend with MA, Volume, RSI, toggle buttons |
| `frontend/hooks/useMarketData.ts` | Stores `history: Map<string, number[]>` (last 100 prices) — add `volumeHistory` here |
| `frontend/lib/types.ts` | `PriceUpdate` has `change_percent` — used for simulated volume |
| `frontend/components/PnLChart.tsx` | Reference for lightweight-charts v5 patterns (createChart, addSeries, ResizeObserver) |

---

## lightweight-charts v5 API Findings (v5.2.0)

### Series creation pattern (existing in codebase)
```typescript
import("lightweight-charts").then(({ createChart, AreaSeries, LineSeries, HistogramSeries }) => {
  const series = chart.addSeries(AreaSeries, { ...options });
  const maLine = chart.addSeries(LineSeries, { ...options });           // pane 0 (default)
  const rsiLine = chart.addSeries(LineSeries, { ...options }, 1);       // pane 1
  const volume  = chart.addSeries(HistogramSeries, { ...options });     // pane 0
});
```

### Multi-pane API
```typescript
// Create second pane for RSI
const rsiPane = chart.addPane();  // returns IPaneApi<Time>
rsiPane.setHeight(100);           // px height
// OR: chart.addSeries(LineSeries, opts, 1) auto-creates pane 1

// Hide RSI pane: setHeight(0) unreliable — use conditional rendering approach instead
```

### Volume overlay pattern
```typescript
chart.addSeries(HistogramSeries, {
  priceScaleId: "volume",            // separate scale, non-overlapping
  scaleMargins: { top: 0.8, bottom: 0 },  // volume uses bottom 20% of pane
  color: "rgba(32, 157, 215, 0.25)",
});
```

### Series visibility toggle
```typescript
series.applyOptions({ visible: false });  // hide without removing
series.applyOptions({ visible: true });   // show again
```

### Price lines for RSI reference bands
```typescript
rsiSeries.createPriceLine({ price: 70, color: "#f85149", lineStyle: 2, lineWidth: 1 });
rsiSeries.createPriceLine({ price: 30, color: "#3fb950", lineStyle: 2, lineWidth: 1 });
rsiSeries.createPriceLine({ price: 50, color: "#7d8590", lineStyle: 2, lineWidth: 1 });
```

---

## Architecture Decisions

### 1. Indicator Computation — Client-Side Only
No backend changes required. All indicators are computed from `history.get(ticker)` (last 100 price points stored in `useMarketData`).

**New file:** `frontend/lib/indicators.ts` — pure functions:
```typescript
export function calcMA(prices: number[], period: number): (number | null)[]
export function calcRSI(prices: number[], period: number): (number | null)[]
```

### 2. Volume Data — Simulated Client-Side
The SSE stream (`PriceUpdate`) carries no volume. Volume is simulated as:
```typescript
Math.round(Math.abs(changePercent) * 500_000 * (0.6 + Math.random() * 0.8))
```
This produces realistic-looking bars (larger moves = larger volume). No backend changes needed.

`useMarketData` adds a parallel `volumeHistory: Map<string, number[]>` (same HISTORY_LENGTH=100). `PriceChart` receives a new `volumeHistory` prop alongside the existing `history` prop.

### 3. RSI Sub-Panel — Multi-Pane vs Separate Chart
**Decision: Single chart with two panes.** Rationale:
- Pane timescales are synchronized — scrolling/zooming main chart also moves RSI panel
- lightweight-charts v5 supports `chart.addSeries(LineSeries, opts, 1)` to add to pane 1
- `pane.setHeight(n)` controls the pane height

**RSI panel hidden via CSS toggle:** Rather than calling `setHeight(0)` (which can leave a stub), the RSI pane is always created but the container div height is toggled using a React state boolean. When `showRSI=false`, the chart container shrinks by removing a bottom section div.

**Simpler alternative (chosen for plan):** Manage RSI as a completely separate `useEffect`/`useRef` chart instance in a `<div>` that is conditionally rendered. When `showRSI` is false the div is not mounted, so the chart is not created. When true, a new chart is created. The RSI chart shares the same time positions (same `lastTimeRef` logic).

**Final decision: Two chart containers, same time positions.** This avoids the complexity of pane height management. The RSI chart is a sibling div below the main chart, both inside the `flex flex-col h-full` container.

### 4. PriceChart Layout with RSI
```
┌────────────────────────────────────────────┐
│ Header (ticker, price, OHLC, range, toggles)│
├────────────────────────────────────────────┤
│                                            │
│  Main chart (flex-1)                       │
│  — AreaSeries (price)                      │
│  — LineSeries MA20 (optional)              │
│  — LineSeries MA50 (optional)              │
│  — HistogramSeries Volume (optional, bottom│
│    20% of this pane via scaleMargins)      │
│                                            │
├────────────────────────────────────────────┤
│  RSI panel (h-28 = 112px, only when on)   │
│  — LineSeries RSI(14)                      │
│  — PriceLines at 70, 50, 30               │
└────────────────────────────────────────────┘
```

### 5. Toggle State
Three boolean toggles stored in PriceChart component state:
```typescript
const [showMA,  setShowMA]  = useState(false);
const [showVol, setShowVol] = useState(false);
const [showRSI, setShowRSI] = useState(false);
```

Toggle buttons placed in chart header after the time range selector, styled like range buttons:
```
[5m] [15m] [1H] [4H] [ALL]   [MA] [VOL] [RSI]
```

MA and VOL are toggled via `series.applyOptions({ visible: bool })` — series always exist after chart init, no add/remove needed.

RSI chart: controlled by `showRSI` state; the div is mounted/unmounted, and a separate `useEffect` watches `[ticker, showRSI]` to create/destroy the RSI chart.

### 6. Live Updates for Indicators
On each `prices` prop change (live SSE tick):
- MA series: call `maXXSeries.update({ time, value: newMA })` — recompute last MA value from updated history
- Volume: call `volumeSeries.update({ time, value: newVolume, color: ... })`
- RSI: call `rsiSeries.update({ time, value: newRSI })`

The `lastTimeRef` ensures ascending time invariant (same pattern as existing AreaSeries update).

### 7. `useMarketData` Extension
Add `volumeHistory: Map<string, number[]>` to `MarketDataState`. On each SSE tick:
```typescript
const vol = Math.round(Math.abs(update.change_percent) * 500_000 * (0.6 + Math.random() * 0.8));
const vols = volumeHistory.get(ticker) ?? [];
const nextVols = [...vols, vol];
volumeHistory.set(ticker, nextVols.length > HISTORY_LENGTH ? nextVols.slice(-HISTORY_LENGTH) : nextVols);
```

---

## Files to Create / Modify

### New
- `frontend/lib/indicators.ts` — `calcMA(prices, period)` and `calcRSI(prices, period)` pure functions

### Modified
- `frontend/hooks/useMarketData.ts` — Add `volumeHistory: Map<string, number[]>` to state + SSE handler
- `frontend/components/PriceChart.tsx` — Add MA, Volume, RSI series + toggle buttons + RSI sub-panel

---

## Indicator Formulas

### Moving Average
```typescript
export function calcMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    return prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}
```

### RSI (Wilder's smoothing)
```typescript
export function calcRSI(prices: number[], period = 14): (number | null)[] {
  if (prices.length < period + 1) return prices.map(() => null);
  const result: (number | null)[] = prices.map(() => null);
  
  // Initial average gain/loss
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  
  // Wilder's smoothing
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}
```

---

## Validation Architecture

| Concern | Validation approach |
|---------|---------------------|
| MA accuracy | With 5 prices [1,2,3,4,5], MA3 should produce [null, null, 2, 3, 4] |
| RSI accuracy | 14 prices of +1 each → RSI=100; 14 prices of -1 each → RSI=0 |
| Volume display | Toggle VOL on, verify histogram bars appear at bottom of chart |
| MA toggle | Toggle MA on, verify MA20/MA50 lines overlay price. Toggle off, lines disappear |
| RSI toggle | Toggle RSI on, verify RSI panel renders below main chart with 70/30 lines |
| Live updates | Price tick updates: MA, VOL, RSI values update on each SSE event |
| Time invariant | No "data must be asc ordered by time" errors in console on toggle |
| Regression | Existing AreaSeries, range buttons, OHLC stats still work after changes |
| TypeScript | `cd frontend && npx tsc --noEmit` passes with zero errors |

---

## Risk / Gotchas

1. **RSI chart time sync**: The RSI chart uses the same `lastTimeRef` logic as the main chart, ensuring ascending time. Populate RSI chart on mount with the same history slice, then update live.

2. **MA series on ticker change**: When `ticker` changes, the entire chart is recreated (`useEffect` depends on `[ticker]`). MA/Volume series refs must be re-created along with the chart. Store all indicator series refs as `useRef`.

3. **HISTORY_LENGTH vs MA period**: With `HISTORY_LENGTH=100`, MA50 requires 50 data points and RSI(14) requires 15 data points. On fresh page load, history builds up over time. The computation handles this correctly by returning `null` for early values (lightweight-charts renders null as a gap in the line).

4. **Volume color by direction**: Color volume bars green/red based on price direction:
   ```typescript
   color: update.direction === "up" ? "rgba(63,185,80,0.4)" : "rgba(248,81,73,0.4)"
   ```

5. **Series visible toggle via applyOptions**: When `showMA` changes and the chart already exists, call `ma20Ref.current?.applyOptions({ visible: showMA })`. This must happen in a `useEffect` that depends on `[showMA]`, separate from the chart creation effect.

## RESEARCH COMPLETE
