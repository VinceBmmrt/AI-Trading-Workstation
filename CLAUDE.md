# AI Trading Workstation Project - the Finance Ally

All project documentation is in the `planning` directory.

The key document is PLAN.md included in full below; the market data component has been completed and is summarized in the file `planning/MARKET_DATA_SUMMARY.md` with more details in the `planning/archive` folder. Consult these docs only when required. The remainder of the platform is still to be developed.

@planning/PLAN.md

<!-- GSD:project-start source:PROJECT.md -->

## Project

**AI Trading Workstation — Finance Ally**

An AI-powered trading terminal that streams live market data, lets users trade a simulated portfolio ($10k virtual cash), and integrates an LLM chat assistant that can analyze positions, suggest trades, and execute them on the user's behalf. Built as a capstone for an agentic AI coding course — the entire application is authored by orchestrated AI agents. Visually inspired by Bloomberg/trading terminals with a dark, data-dense aesthetic.

**Core Value:** A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.

### Constraints

- **Tech Stack**: Python/uv (no pip), FastAPI, Next.js static export, SQLite — no substitutions; students follow this exactly
- **Single Port**: Everything on port 8000 — no CORS, no separate frontend server in production
- **Single Container**: One `docker run` command — no docker-compose for production use
- **Environment**: `.env` at project root; `OPENROUTER_API_KEY` required; `MASSIVE_API_KEY` and `LLM_MOCK` optional
- **LLM**: Cerebras via OpenRouter (`openrouter/openai/gpt-oss-120b`, provider order: `["cerebras"]`) — not configurable by user

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 16 + React 19, TypeScript, Tailwind CSS v4 | Static export (`output: "export"`), React Compiler enabled |
| Charts | Lightweight Charts v5.2 | `addSeries(SeriesType, opts)` API; always use `"use no memo"` on chart components |
| Backend | FastAPI (Python 3.12), uv package manager | `uv run`, never `python3` or `pip` |
| Database | SQLite via `sqlite3` stdlib | WAL mode, single file at `db/AI Trading Workstation.db` |
| Real-time | Server-Sent Events (`/api/stream/prices`) | Native `EventSource`, 500ms cadence |
| AI | LiteLLM → OpenRouter (Cerebras) | See cerebras-inference skill for model ID and routing |
| Containerization | Docker multi-stage (Node → Python) | Single port 8000; rebuild with `--no-cache` when frontend changes |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

### Frontend
- Components are `"use client"` React function components with TypeScript
- Tailwind v4: theme tokens defined in `globals.css` via `@theme {}` (no `tailwind.config.js`)
- CSS variables: `--color-bg`, `--color-surface`, `--color-up` (#3fb950), `--color-down` (#f85149), `--color-accent` (#ecad0a), `--color-blue` (#209dd7)
- LWC chart components **must** include `"use no memo";` as the first line of the function body to prevent React Compiler from suppressing the chart `useEffect`
- Chart `useEffect(fn, [])`: the `containerRef` div must always be in the DOM on first mount (never conditionally rendered) so the effect can mount LWC; empty states should be overlaid on top of the container, not replace it
- Always set `cancelled = true` in the effect return: `return () => { cancelled = true; cleanup?.(); }`
- Always rebuild Docker with `--no-cache` when frontend code changes (layer cache will serve stale JS otherwise)

### Backend
- All routes live in `backend/app/routes/`; market data in `backend/app/market/`
- Database seeding: `init_db()` uses `INSERT OR IGNORE` for all `DEFAULT_TICKERS` on every startup — new tickers added to code auto-appear on next container start
- Tickers must match `^[A-Z]{1,5}$` — no dots (e.g. use `AXP` not `BRK.B`)
- Sector metadata lives in `backend/app/market/sectors.py` (`SECTOR_MAP` + `get_sector()`)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

### Frontend layout (desktop)
```
┌─────────────────────────────────────────────────────────────────┐
│  Header (portfolio value, P&L, cash, clock, settings)          │
│  MarketBreadthBar (▲N GAIN ▼N LOSS, VOL level)                 │
│  MarketSummaryBanner (session, paper trading badges)            │
├──────────────┬──────────────────────────────┬───────────────────┤
│ WatchlistPanel│      PriceChart              │  ChatPanel        │
│ (2-col grid, │  (L/A/C toggle, MA/VOL/RSI)  │  (collapsible)    │
│  33 tickers, │                              │                   │
│  sector tabs,├──────────────────────────────┤                   │
│  search)     │ PnLChart │ PositionsTable     │                   │
│              │ (always  │ (or History /      │                   │
│  TradeBar    │ visible) │  Analytics tabs)   │                   │
│  (BUY/SELL)  ├──────────┤                   │                   │
│              │ Heatmap  │                   │                   │
└──────────────┴──────────┴───────────────────┴───────────────────┘
│  StatusBar (connection, ticker count, paper badge)              │
```

### Key data flows
- SSE stream → `useMarketData` hook → `prices` Map → WatchlistPanel cards + PriceChart live updates + MarketBreadthBar
- Portfolio snapshots (every 30s + on trade) → `/api/portfolio/history` → PnLChart
- `DEFAULT_TICKERS` (33) → SQLite watchlist on first boot → `/api/watchlist` → frontend

### Watchlist (33 tickers, 6 sectors)
- **Tech** (14): AAPL GOOGL MSFT AMZN TSLA NVDA META NFLX AMD INTC CRM ORCL SNOW PLTR
- **Finance** (6): JPM V GS MS BAC AXP
- **Health** (4): JNJ UNH PFE LLY
- **Energy** (3): XOM CVX OXY
- **Consumer** (3): WMT COST MCD
- **ETF** (3): SPY QQQ IWM
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| cerebras-inference | Use this to write code to call an LLM using LiteLLM and OpenRouter with the Cerebras inference provider | `.claude/skills/cerebras/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
