# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28)

**Core value:** A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.
**Current focus:** Phase 11 — Price Alerts & Notifications (up next)

## Current Phase

**Phase 11: Price Alerts & Notifications** — 📋 Planned

Goal: Users and the AI can set price level triggers. When a ticker crosses the threshold, a visible alert fires and the AI references it in chat context.

### Active Work

(none — planning in progress)

## Previous Phase

**Phase 10: AI Intelligence Upgrade** — ✅ Completed (2026-05-28)

Goal: Proactive market alerts, enriched LLM context, polling endpoint, market-summary endpoint, slash commands, MarketSummaryBanner.

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

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app — lifespan, routes, SSE |
| `backend/app/routes/chat.py` | LLM chat + market-summary + message history endpoints |
| `backend/app/routes/portfolio.py` | Portfolio, trades, analytics endpoints |
| `backend/app/market/` | Price cache, simulator, Massive API |
| `frontend/components/TradeBar.tsx` | Trade bar |
| `frontend/components/PriceChart.tsx` | Price chart with MA/RSI/Volume overlays |
| `frontend/components/ChatPanel.tsx` | AI chat with slash commands and polling |
| `frontend/components/MarketSummaryBanner.tsx` | Proactive market summary banner |
| `frontend/app/page.tsx` | Main page layout — mobile + desktop responsive |
| `Dockerfile` | Multi-stage build |
| `.env.example` | Environment variable reference |

---
*State initialized: 2026-05-26*
*Last updated: 2026-05-28*
