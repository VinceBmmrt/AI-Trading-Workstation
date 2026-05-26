# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-26)

**Core value:** A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.
**Current focus:** Phase 7 — Bug Fixes & Polish

## Current Phase

**Phase 7: Bug Fixes & Polish** — 🔄 In Progress

Goal: The two known bugs are fixed, committed, and verified. App is in demo-ready state.

### Active Work

| Item | Status | Notes |
|------|--------|-------|
| BUG-01: TradeBar overflow | ✅ Fixed | Two-row layout in `frontend/components/TradeBar.tsx` |
| BUG-02: Chat trade errors | ✅ Fixed | Watchlist changes before trades + asyncio.sleep(0.6) in `backend/app/routes/chat.py` |
| Commit fixes | ⏳ Pending | Changes not yet committed |
| Run backend tests | ⏳ Pending | Verify chat.py changes don't break existing tests |
| Create PR | ⏳ Pending | PR from `feat/backend-api` |

### Success Criteria Checklist

- [ ] TradeBar shows two rows — buttons never overflow watchlist column
- [ ] AI chat executes trades for newly-added watchlist tickers without errors
- [ ] Both fixes committed and PR created
- [ ] `uv run --extra dev pytest tests/ -v` passes after chat.py changes

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
