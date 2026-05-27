# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-26)

**Core value:** A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.
**Current focus:** Phase 8 — Trade History & Portfolio Analytics

## Current Phase

**Phase 8: Trade History & Portfolio Analytics** — 🗓 Planned (plans written 2026-05-27)

Goal: The Positions panel becomes a full analytics dashboard with trade history, performance metrics, and CSV export.

### Active Work

| Item | Status | Notes |
|------|--------|-------|
| Trade log tab | ⏳ Pending | Full history table in portfolio panel |
| Analytics cards | ⏳ Pending | Total return, best/worst performer, win rate |
| Realized vs unrealized P&L | ⏳ Pending | Breakdown display |
| CSV export | ⏳ Pending | Download trade history |

### Success Criteria Checklist

- [ ] Trade log tab shows all executed trades, newest first, with P&L
- [ ] Analytics cards update live with price changes and new trades
- [ ] Win rate correctly calculated from closed positions
- [ ] CSV export downloads valid file with full trade history

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

## Phase History

| Phase | Completed | Key Deliverable |
|-------|-----------|-----------------|
| Phase 1: Market Data | 2026-05 | GBM simulator + Massive API + SSE streaming + price cache |
| Phase 2: Portfolio & Backend | 2026-05 | FastAPI routes + SQLite DB + trade execution + watchlist |
| Phase 3: AI Chat | 2026-05 | LiteLLM/Cerebras integration + structured output + auto-execution |
| Phase 4: Frontend Dashboard | 2026-05 | Next.js components — watchlist, chart, heatmap, positions, trade bar, chat |
| Phase 5: Docker | 2026-05 | Multi-stage Dockerfile + start/stop scripts |
| Phase 6: Testing | 2026-05 | 128 backend unit tests + 8 E2E Playwright tests |

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
