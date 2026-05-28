# AI Trading Workstation — Finance Ally

## What This Is

An AI-powered trading terminal that streams live market data, lets users trade a simulated portfolio ($10k virtual cash), and integrates an LLM chat assistant that can analyze positions, suggest trades, and execute them on the user's behalf. Built as a capstone for an agentic AI coding course — the entire application is authored by orchestrated AI agents. Visually inspired by Bloomberg/trading terminals with a dark, data-dense aesthetic.

## Core Value

A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.

## Requirements

### Validated

- ✓ Live price streaming via SSE — prices flash green/red on change — Phase 1
- ✓ GBM market simulator with realistic seed prices, correlated moves, drift/volatility per ticker — Phase 1
- ✓ Massive API (Polygon.io) integration with same interface as simulator — Phase 1
- ✓ Shared price cache (thread-safe, version-tracked, used by SSE and portfolio) — Phase 1
- ✓ FastAPI backend with SQLite — all tables created on startup via lifespan event — Phase 2
- ✓ Portfolio REST API: GET positions/cash/P&L, POST trade (buy/sell), GET snapshots history — Phase 2
- ✓ Watchlist REST API: GET/POST/DELETE — Phase 2
- ✓ Market orders with instant fill at current price, no fees, no confirmation — Phase 2
- ✓ Portfolio snapshots recorded every 30s and after each trade — Phase 2
- ✓ LLM chat via LiteLLM → OpenRouter → Cerebras, structured JSON output — Phase 3
- ✓ Auto-execution of trades and watchlist changes from LLM response — Phase 3
- ✓ LLM mock mode (LLM_MOCK=true) for deterministic E2E testing — Phase 3
- ✓ Next.js frontend with Watchlist panel, Price chart, Portfolio heatmap, Positions table, P&L chart, Trade bar, Chat panel, Header — Phase 4
- ✓ Price flash animations (green/red CSS transitions on SSE update) — Phase 4
- ✓ Sparkline mini-charts accumulated from SSE since page load — Phase 4
- ✓ Chat panel with trade/watchlist action confirmations shown inline — Phase 4
- ✓ Docker multi-stage build (Node → Python), single container on port 8000 — Phase 5
- ✓ Start/stop scripts for Windows (PowerShell) and macOS (bash) — Phase 5
- ✓ 128 backend unit tests (market data, portfolio, LLM, routes) — Phase 6
- ✓ 8 E2E Playwright tests covering key user flows — Phase 6
- ✓ TradeBar layout fix — buttons no longer overflow watchlist column — Phase 7
- ✓ Chat trade sequencing fix — new watchlist tickers get prices before trades execute — Phase 7
- ✓ Mobile-responsive layout — bottom tab nav for <768px, 3-column desktop at ≥768px — Phase 7
- ✓ Trade log tab — full history table (date, ticker, side, qty, price, P&L at close) — Phase 8
- ✓ Portfolio analytics cards — total return %, best/worst performer, win rate — Phase 8
- ✓ Realized vs unrealized P&L breakdown — Phase 8
- ✓ CSV export of trade history — Phase 8
- ✓ MA20/MA50 overlay lines on price chart, toggleable — Phase 9
- ✓ RSI(14) sub-panel with 70/30 reference lines — Phase 9
- ✓ Volume histogram at bottom of price chart — Phase 9
- ✓ All indicators update in real time from SSE — Phase 9
- ✓ Proactive AI commentary on >2% price moves in chat — Phase 10
- ✓ Market summary banner on page load (AI-generated from live prices) — Phase 10
- ✓ Enriched LLM system prompt — risk concentration, largest mover, unrealized P&L by position — Phase 10
- ✓ Slash command shortcuts in chat: /analyze, /rebalance, /risk — Phase 10
- ✓ GET /api/chat/messages — conversation history polling endpoint — Phase 10
- ✓ GET /api/chat/market-summary — market summary generation endpoint — Phase 10

### Active

(none — phases 1–10 complete, planning Phase 11)

### Out of Scope

- User accounts / authentication — single-user by design; `user_id="default"` hardcoded
- Limit orders / partial fills — market orders only, eliminates order book complexity
- Real money / real brokerage — simulation only, fake cash
- Multi-container Docker Compose for production — single container keeps student setup trivial
- Paid Polygon.io tiers — only free tier (15s poll) specified; paid-tier specifics not implemented
- Cloud deployment (Terraform/App Runner) — stretch goal, not in scope for this version

## Context

- **Stack**: FastAPI (Python/uv), SQLite, Next.js TypeScript static export, Tailwind CSS, SSE for real-time, LiteLLM/OpenRouter/Cerebras for AI
- **Architecture**: Single Docker container on port 8000; FastAPI serves REST/SSE API and static Next.js export; SQLite volume-mounted at `/app/db`
- **Market data**: GBM simulator default; Massive (Polygon.io) REST API optional via `MASSIVE_API_KEY` env var
- **Database**: Initialized on startup via lifespan event — no migrations, no manual setup; default user seeded with $10k cash and 10-ticker watchlist
- **Course context**: This is a capstone project demonstrating AI agents building a full-stack production app; code quality and patterns matter for student learning
- **Current branch**: `feat/backend-api` — phases 1–10 complete and committed; Phase 11 (Price Alerts) up next

## Constraints

- **Tech Stack**: Python/uv (no pip), FastAPI, Next.js static export, SQLite — no substitutions; students follow this exactly
- **Single Port**: Everything on port 8000 — no CORS, no separate frontend server in production
- **Single Container**: One `docker run` command — no docker-compose for production use
- **Environment**: `.env` at project root; `OPENROUTER_API_KEY` required; `MASSIVE_API_KEY` and `LLM_MOCK` optional
- **LLM**: Cerebras via OpenRouter (`openrouter/openai/gpt-oss-120b`, provider order: `["cerebras"]`) — not configurable by user

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SSE over WebSockets | One-way push only needed; simpler, universal browser support | ✓ Good |
| Static Next.js export | Single origin, no CORS, one port, one container | ✓ Good |
| SQLite over Postgres | Single user, no server, zero config, self-contained | ✓ Good |
| Single Docker container | Students run one command; no orchestration complexity | ✓ Good |
| Market orders only | Eliminates order book, partial fills, complex portfolio math | ✓ Good |
| DB init on startup via lifespan | No race conditions, no separate migration step | ✓ Good |
| LLM auto-executes trades without confirmation | Fake money, impressive demo, demonstrates agentic capability | ✓ Good |
| Watchlist changes run before trades in chat | New tickers need time to get prices before trades can execute | ✓ Validated (Phase 7 fix) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-28*
