# AI Trading Workstation — Finance Ally

A visually rich, AI-powered trading terminal. Stream live market data, trade a simulated portfolio, and chat with an AI assistant that can analyze positions and execute trades on your behalf.

## What It Does

- **Live price streaming** — prices flash green/red on change via SSE, sparkline charts fill progressively
- **Simulated trading** — $10,000 in virtual cash, instant market-order fills, no fees
- **Portfolio dashboard** — treemap heatmap by P&L weight, positions table, P&L chart over time
- **AI chat assistant** — ask about your portfolio, request trades, manage your watchlist in natural language
- **Watchlist management** — add/remove tickers manually or through the AI

## Architecture

Single Docker container on port 8000. FastAPI serves both the REST/SSE API and the static Next.js frontend.

```
FastAPI (Python/uv)
├── /api/*          REST endpoints
├── /api/stream/*   SSE price stream
└── /*              Static Next.js export

SQLite (volume-mounted)
Market data: GBM simulator (default) or Massive/Polygon.io API
LLM: LiteLLM → OpenRouter (Cerebras inference)
```

## Quick Start

```bash
# Copy and fill in your API key
cp .env.example .env

# Build and run (Docker required)
docker run -v ai-trading-workstation-data:/app/db \
           -p 8000:8000 \
           --env-file .env \
           ai-trading-workstation
```

Then open [http://localhost:8000](http://localhost:8000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Powers the AI chat assistant |
| `MASSIVE_API_KEY` | No | Real market data (Polygon.io); simulator used if absent |
| `LLM_MOCK` | No | Set `true` for deterministic mock LLM responses (testing) |

## Development

```bash
# Backend
cd backend
uv sync --dev
uv run pytest -v

# Live market data demo (terminal dashboard)
uv run market_data_demo.py
```

See `backend/README.md` for full backend documentation.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, uv |
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Database | SQLite |
| Real-time | Server-Sent Events (SSE) |
| AI | LiteLLM → OpenRouter (Cerebras) |
| Deployment | Docker (single container) |
