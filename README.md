# AI Trading Workstation — Finance Ally

A visually rich, AI-powered trading terminal. Stream live market data, trade a simulated portfolio, and chat with an AI assistant that can analyze positions and execute trades on your behalf.

## What It Does

- **Live price streaming** — prices flash green/red on change via SSE, sparkline charts fill progressively
- **Simulated trading** — $10,000 in virtual cash, instant market-order fills, no fees
- **Portfolio dashboard** — treemap heatmap by P&L weight, positions table, P&L chart over time
- **AI chat assistant** — ask about your portfolio, request trades, manage your watchlist in natural language
- **Watchlist management** — add/remove tickers manually or through the AI

## Quick Start (Docker)

**1. Set up your environment:**
```powershell
copy .env.example .env
# Edit .env and add your OPENROUTER_API_KEY
```

**2. Build and run (first time):**
```powershell
.\scripts\start_windows.ps1 -Build
```

**Subsequent runs** (image already built):
```powershell
.\scripts\start_windows.ps1
```

Open [http://localhost:8000](http://localhost:8000).

**Stop:**
```powershell
.\scripts\stop_windows.ps1
```

**Rebuild after code changes:**
```powershell
.\scripts\start_windows.ps1 -Build
```

---

## Local Dev (no Docker, faster iteration)

**Terminal 1 — Backend:**
```powershell
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The frontend dev server proxies API calls to `localhost:8000` automatically.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Powers the AI chat assistant |
| `MASSIVE_API_KEY` | No | Real market data (Polygon.io); simulator used if absent |
| `LLM_MOCK` | No | Set `true` for deterministic mock LLM responses (testing) |

---

## Tests

**Backend unit tests (128 tests):**
```powershell
cd backend
uv run --extra dev pytest tests/ -v
```

**E2E Playwright tests** (requires the app running on port 8000):
```powershell
cd test
npm install
npx playwright install chromium
npx playwright test --reporter=list
```

---

## Architecture

Single Docker container on port 8000. FastAPI serves both the REST/SSE API and the static Next.js frontend.

```
FastAPI (Python/uv)
├── /api/*          REST endpoints
├── /api/stream/*   SSE price stream
└── /*              Static Next.js export

SQLite (volume-mounted at /app/db)
Market data: GBM simulator (default) or Massive/Polygon.io API
LLM: LiteLLM → OpenRouter (Cerebras inference)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, uv |
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Database | SQLite |
| Real-time | Server-Sent Events (SSE) |
| AI | LiteLLM → OpenRouter (Cerebras) |
| Deployment | Docker (single container) |
