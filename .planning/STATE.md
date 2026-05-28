# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-26)

**Core value:** A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.
**Current focus:** Phase 9 — Technical Indicators & Chart Upgrades (planned, ready to execute)

## Current Phase

**Phase 9: Technical Indicators & Chart Upgrades** — 🗓 Planned (plans written 2026-05-28, ready to execute)

Goal: PriceChart gains toggleable MA20/MA50 overlays, volume histogram, and RSI(14) sub-panel.

### Active Work

| Item | Status | Notes |
|------|--------|-------|
| indicators.ts library | ⏳ Pending | calcMA + calcRSI pure functions |
| volumeHistory in useMarketData | ⏳ Pending | Simulated volume from change_percent |
| PriceChart MA overlays | ⏳ Pending | MA20 (yellow) + MA50 (purple) toggleable |
| PriceChart volume histogram | ⏳ Pending | Bottom 20% of chart pane |
| RSI sub-panel | ⏳ Pending | Separate chart div, 70/50/30 reference lines |

## Previous Phase

**Phase 8: Trade History & Portfolio Analytics** — ✅ Completed (2026-05-28)

Goal: PriceChart gains toggleable MA20/MA50 overlays, volume histogram, and RSI(14) sub-panel.

## Phase History

| Phase | Completed | Key Deliverable |
|-------|-----------|-----------------|
| Phase 1: Market Data | 2026-05 | GBM simulator + Massive API + SSE streaming + price cache |
| Phase 2: Portfolio & Backend | 2026-05 | FastAPI routes + SQLite DB + trade execution + watchlist |
| Phase 3: AI Chat | 2026-05 | LiteLLM/Cerebras integration + structured output + auto-execution |
| Phase 4: Frontend Dashboard | 2026-05 | Next.js components — watchlist, chart, heatmap, positions, trade bar, chat |
| Phase 5: Docker | 2026-05 | Multi-stage Dockerfile + start/stop scripts |
| Phase 6: Testing | 2026-05 | 128 backend unit tests + 8 E2E Playwright tests |
| Phase 7: Bug Fixes & Polish | 2026-05 | TradeBar layout fix, chat trade sequencing fix, production UI v2, responsive layout |
| Phase 8: Trade History & Analytics | 2026-05-28 | Trade log tab, analytics cards, realized/unrealized P&L, CSV export |

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app — lifespan, routes, SSE |
| `backend/app/routes/chat.py` | LLM chat endpoint — BUG-02 fixed here |
| `backend/app/market/` | Price cache, simulator, Massive API |
| `frontend/components/TradeBar.tsx` | Trade bar — BUG-01 fixed here |
| `frontend/app/page.tsx` | Main page layout |
| `Dockerfile` | Multi-stage build |
| `.env.example` | Environment variable reference |

---
*State initialized: 2026-05-26*
*Last updated: 2026-05-26*
