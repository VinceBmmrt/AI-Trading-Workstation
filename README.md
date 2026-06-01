# Finance Ally — AI Trading Workstation

> An AI-powered trading terminal inspired by Bloomberg. Stream live prices, trade a simulated portfolio, and chat with an AI that executes trades on your behalf — all in a single Docker container.

<p align="center">
  <img src="demo/trade station screen.png" alt="Finance Ally — AI Trading Workstation" width="880"/>
</p>

<p align="center">
  <a href="https://drive.google.com/file/d/1gxxYV38R6E_3Rfu3YcnH3zO5eW3wTNzU/view?usp=sharing">
    <img src="https://img.shields.io/badge/▶ Watch Demo-Google Drive-blue?style=for-the-badge&logo=google-drive" alt="Watch Demo"/>
  </a>
</p>

---

## Features

| | |
|---|---|
| **Live price streaming** | 33 tickers across 6 sectors, SSE-powered, green/red flash animations |
| **Compact watchlist grid** | 2-column card layout with sector tabs (TECH / FIN / HEALTH / ENERGY / CONS / ETF), search, and live sparklines |
| **Price charts** | Line, area, and candlestick modes with MA, Volume, and RSI overlays |
| **Portfolio P&L** | Always-visible area chart tracking portfolio value over time |
| **Holdings heatmap** | Treemap sized by weight, colored by unrealized P&L |
| **Simulated trading** | $10,000 virtual cash · instant fills · no fees · configurable starting capital |
| **AI chat assistant** | Powered by Cerebras via OpenRouter — analyzes positions, suggests and executes trades, manages watchlist |
| **Market breadth bar** | Live ▲ Gainers / ▼ Losers count with volatility indicator |
| **Price alerts** | Set above/below triggers per ticker; toast notifications on fire |
| **Settings** | Light/dark theme, starting capital, portfolio reset |

---

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- An [OpenRouter](https://openrouter.ai/) API key

### Run with Docker

```bash
# 1. Copy and fill in your API key
cp .env.example .env
# Edit .env → set OPENROUTER_API_KEY=your-key

# 2. Build and start (first time)
.\scripts\start_windows.ps1 -Build     # Windows
# or: bash scripts/start_mac.sh --build  # macOS / Linux

# 3. Open the app
# http://localhost:8000
```

**Subsequent starts** (no rebuild needed):
```bash
.\scripts\start_windows.ps1
```

**Stop:**
```bash
.\scripts\stop_windows.ps1
```

> Your portfolio persists across restarts via a named Docker volume (`ai-trading-workstation-data`).

---

## Local Dev (hot reload, no Docker)

```bash
# Terminal 1 — Backend
cd backend
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
# → http://localhost:3000 (proxies /api/* to :8000)
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** | Powers the AI chat assistant (Cerebras via OpenRouter) |
| `MASSIVE_API_KEY` | No | Real market data via Polygon.io; built-in GBM simulator used if absent |
| `LLM_MOCK` | No | Set `true` for deterministic mock LLM responses (CI / testing) |

---

## Watchlist — 33 Tickers, 6 Sectors

| Sector | Tickers |
|--------|---------|
| Tech | AAPL · GOOGL · MSFT · AMZN · TSLA · NVDA · META · NFLX · AMD · INTC · CRM · ORCL · SNOW · PLTR |
| Finance | JPM · V · GS · MS · BAC · AXP |
| Healthcare | JNJ · UNH · PFE · LLY |
| Energy | XOM · CVX · OXY |
| Consumer | WMT · COST · MCD |
| ETF | SPY · QQQ · IWM |

Tickers are seeded automatically on first boot. Add or remove any ticker via the UI or AI chat.

---

## Architecture

Single Docker container, single port. FastAPI serves the REST/SSE API and the compiled Next.js static frontend.

```
Docker container (port 8000)
│
├── FastAPI (Python / uv)
│   ├── /api/*            REST endpoints (portfolio, watchlist, chat, alerts, settings)
│   ├── /api/stream/prices  SSE price stream (500 ms cadence)
│   └── /*                Static Next.js export
│
├── SQLite (volume-mounted at /app/db)
│   └── users_profile · watchlist · positions · trades
│       portfolio_snapshots · chat_messages · price_alerts · app_settings
│
├── Market data
│   ├── GBM Simulator (default) — correlated Geometric Brownian Motion, 33 tickers
│   └── Massive / Polygon.io API (optional, set MASSIVE_API_KEY)
│
└── LLM: LiteLLM → OpenRouter → Cerebras inference
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 · FastAPI · uv |
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 |
| Charts | Lightweight Charts v5 |
| Database | SQLite (WAL mode) |
| Real-time | Server-Sent Events (SSE) |
| AI | LiteLLM → OpenRouter (Cerebras) |
| Deployment | Docker · single container · single port |

---

## Tests

**Backend unit tests:**
```bash
cd backend
uv run --extra dev pytest tests/ -v
```

**E2E Playwright tests** (requires app running on port 8000):
```bash
cd test
npm install
npx playwright install chromium
npx playwright test --reporter=list
```

---

## Project Context

Built as a capstone for an **agentic AI coding course** — the entire application is authored by orchestrated AI agents using Claude Code. It demonstrates how LLM-powered agents can produce a production-quality, full-stack application from a spec document.
