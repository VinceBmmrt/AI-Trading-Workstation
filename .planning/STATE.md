# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28)

**Core value:** A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.
**Current focus:** All 12 phases complete — project done.

## Current Phase

**All phases complete.** The project is in a demo-ready, fully-featured state.

### Active Work

(none)

## Previous Phase

**Phase 12: Settings & User Control** — ✅ Completed (2026-05-29)

Goal: Portfolio reset, configurable starting capital, layout preference persistence, dark/light theme toggle.

Deliverables:
- `app_settings` SQLite table, `GET/PUT /api/settings` REST endpoints
- `POST /api/portfolio/reset` — clears positions/trades/snapshots, restores cash to configured capital
- `STARTING_CAPITAL` hardcoding removed from both `portfolio.py` and `Header.tsx`
- `html.light` CSS class toggles 11 custom property overrides for light theme
- `useTheme` hook — SSR-safe localStorage init, DOM class management
- `SettingsPanel` component — theme switcher, starting capital input, two-step reset confirm
- localStorage persistence for `selectedTicker`, `chatOpen`, `portfolioTab`, `mobilePanel`
- Gear icon `⚙` in Header opens SettingsPanel
- 14 new unit tests, 172 total passing

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
| Phase 12: Settings & User Control | 2026-05-29 | app_settings table, settings API, portfolio reset, theme toggle, layout persistence, SettingsPanel, gear icon |

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app — lifespan, routes, SSE, _alert_check_loop |
| `backend/app/routes/alerts.py` | Price alerts REST CRUD |
| `backend/app/routes/settings.py` | App settings REST (starting_capital) |
| `backend/app/routes/chat.py` | LLM chat + market-summary + message history endpoints |
| `backend/app/routes/portfolio.py` | Portfolio, trades, analytics, reset endpoints |
| `backend/app/market/` | Price cache, simulator, Massive API, SSE stream with alert_queue drain |
| `frontend/components/WatchlistPanel.tsx` | Watchlist with bell icon + AlertPopover |
| `frontend/components/AlertPopover.tsx` | Alert creation popover |
| `frontend/components/ToastContainer.tsx` | Toast notifications (fixed bottom-right) |
| `frontend/components/SettingsPanel.tsx` | Settings modal — theme, capital, reset |
| `frontend/hooks/useAlerts.ts` | Alert state + toast lifecycle management |
| `frontend/hooks/useMarketData.ts` | SSE hook with onAlertFired callback |
| `frontend/hooks/useTheme.ts` | Theme toggle with localStorage persistence |
| `frontend/components/PriceChart.tsx` | Price chart with MA/RSI/Volume overlays |
| `frontend/components/ChatPanel.tsx` | AI chat with slash commands and polling |
| `frontend/components/Header.tsx` | Header with gear icon + dynamic starting capital |
| `frontend/components/MarketSummaryBanner.tsx` | Proactive market summary banner |
| `frontend/app/page.tsx` | Main page layout — mobile + desktop responsive, localStorage persistence |
| `Dockerfile` | Multi-stage build |
| `.env.example` | Environment variable reference |

---
*State initialized: 2026-05-26*
*Last updated: 2026-05-29 — Phase 12 complete, all 12 phases done*
