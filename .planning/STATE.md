# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28)

**Core value:** A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.
**Current focus:** Phase 12 — Settings & User Control (next up)

## Current Phase

**Phase 12: Settings & User Control** — 📋 Planned (2 plans, 2 waves, ready to execute)

Goal: Portfolio reset, configurable starting capital, layout preference persistence, dark/light theme toggle.

### Active Work

(none — planning complete, awaiting execution)

## Previous Phase

**Phase 11: Price Alerts & Notifications** — ✅ Completed (2026-05-29)

Goal: Users and the AI can set price level triggers. When a ticker crosses the threshold, a visible alert fires and the AI references it in chat context.

Deliverables:
- `price_alerts` SQLite table, REST CRUD (`GET/POST/DELETE /api/alerts`)
- `_alert_check_loop` background task — fires within 500ms of price crossing
- SSE stream emits `event: alert_fired` named events
- Fired alerts injected into AI `_portfolio_context()` (last 30 min)
- Bell icon hover UI in WatchlistPanel → AlertPopover component
- `useAlerts` hook + `ToastContainer` — 4s auto-dismiss toasts, bottom-right
- `useMarketData` extended with `onAlertFired` callback via `useRef` (no EventSource recreation)
- 8 new unit tests, 158 total passing

## Phase History

| Phase | Completed | Key Deliverable |
|-------|-----------|-----------------|
| Phase 1: Market Data | 2026-05 | GBM simulator + Massive API + SSE streaming + price cache |
| Phase 2: Portfolio & Backend | 2026-05 | FastAPI routes + SQLite DB + trade execution + watchlist |
| Phase 3: AI Chat | 2026-05 | LiteLLM/Cerebras integration + structured output + auto-execution |
| Phase 4: Frontend Dashboard | 2026-05 | Next.js components — watchlist, chart, heatmap, positions, trade bar, chat |
| Phase 5: Docker | 2026-05 | Multi-stage Dockerfile + start/stop scripts |
| Phase 6: Testing | 2026-05 | 128 backend unit tests + 8 E2E Playwright tests |
| Phase 7: Bug Fixes & Polish | 2026-05-28 | TradeBar layout fix, chat trade sequencing fix, production UI v2, responsive mobile layout |
| Phase 8: Trade History & Analytics | 2026-05-28 | Trade log tab, analytics cards, realized/unrealized P&L, CSV export |
| Phase 9: Chart Indicators | 2026-05-28 | MA20/MA50 overlays, volume histogram, RSI sub-panel, indicators.ts library |
| Phase 10: AI Intelligence Upgrade | 2026-05-28 | Proactive alerts, enriched context, polling endpoint, market-summary, slash commands, MarketSummaryBanner |
| Phase 11: Price Alerts & Notifications | 2026-05-29 | Bell icon UI, AlertPopover, ToastContainer, useAlerts hook, SSE alert_fired events, DB table, background check loop |

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app — lifespan, routes, SSE, _alert_check_loop |
| `backend/app/routes/alerts.py` | Price alerts REST CRUD |
| `backend/app/routes/chat.py` | LLM chat + market-summary + message history endpoints |
| `backend/app/routes/portfolio.py` | Portfolio, trades, analytics endpoints |
| `backend/app/market/` | Price cache, simulator, Massive API, SSE stream with alert_queue drain |
| `frontend/components/WatchlistPanel.tsx` | Watchlist with bell icon + AlertPopover |
| `frontend/components/AlertPopover.tsx` | Alert creation popover |
| `frontend/components/ToastContainer.tsx` | Toast notifications (fixed bottom-right) |
| `frontend/hooks/useAlerts.ts` | Alert state + toast lifecycle management |
| `frontend/hooks/useMarketData.ts` | SSE hook with onAlertFired callback |
| `frontend/components/PriceChart.tsx` | Price chart with MA/RSI/Volume overlays |
| `frontend/components/ChatPanel.tsx` | AI chat with slash commands and polling |
| `frontend/components/MarketSummaryBanner.tsx` | Proactive market summary banner |
| `frontend/app/page.tsx` | Main page layout — mobile + desktop responsive |
| `Dockerfile` | Multi-stage build |
| `.env.example` | Environment variable reference |

---
*State initialized: 2026-05-26*
*Last updated: 2026-05-29*
