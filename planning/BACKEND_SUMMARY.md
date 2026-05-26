# Backend — Summary

**Status:** Complete, running, manually verified.

## What Was Built

A full FastAPI backend in `backend/app/` wiring together the market data subsystem, SQLite persistence, all REST/SSE endpoints, and LLM-powered chat.

## Module Map

```
backend/
├── app/
│   ├── main.py          — FastAPI app, lifespan, routers, static mount
│   ├── db.py            — SQLite schema, init, execute_trade, take_snapshot
│   ├── market/          — (pre-existing, see MARKET_DATA_SUMMARY.md)
│   └── routes/
│       ├── health.py    — GET /api/health
│       ├── watchlist.py — GET/POST /api/watchlist, DELETE /api/watchlist/{ticker}
│       ├── portfolio.py — GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history
│       └── chat.py      — POST /api/chat
├── market_data_demo.py  — Rich terminal demo (uv run market_data_demo.py)
└── pyproject.toml       — dependencies: fastapi, uvicorn, litellm, pydantic, python-dotenv, numpy, massive
```

## Startup Sequence (lifespan)

1. `load_dotenv` reads `.env` from project root
2. `init_db()` creates SQLite tables and seeds default user + 10-ticker watchlist (idempotent)
3. `create_market_data_source()` picks `SimulatorDataSource` (default) or `MassiveDataSource` (if `MASSIVE_API_KEY` set)
4. `source.start(tickers)` — begins price updates into `PriceCache`
5. Background task: `take_snapshot()` every 30 seconds
6. On shutdown: cancel snapshot task, `source.stop()`

## Database

SQLite at `db/AI Trading Workstation.db` (volume-mounted in Docker). Six tables:

| Table | Purpose |
|---|---|
| `users_profile` | Cash balance (`id='default'`, `cash_balance=10000.0`) |
| `watchlist` | Watched tickers (seeded: AAPL GOOGL MSFT AMZN TSLA NVDA META JPM V NFLX) |
| `positions` | Open holdings: ticker, quantity, avg_cost |
| `trades` | Append-only trade log (UUID pk) |
| `portfolio_snapshots` | Total value over time (every 30s + after each trade) |
| `chat_messages` | Conversation history with JSON `actions` column |

## API Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{"status": "ok"}` |
| GET | `/api/stream/prices` | SSE — all ticker prices every 500ms |
| GET | `/api/watchlist` | Tickers with live price, change_percent, direction |
| POST | `/api/watchlist` | Body: `{ticker}` — adds to DB + market source |
| DELETE | `/api/watchlist/{ticker}` | Removes from DB + market source + price cache |
| GET | `/api/portfolio` | Cash, positions with P&L, total value |
| POST | `/api/portfolio/trade` | Body: `{ticker, quantity, side}` — instant fill at live price |
| GET | `/api/portfolio/history` | Portfolio value snapshots (for P&L chart) |
| POST | `/api/chat` | LLM chat — auto-executes trades and watchlist changes |

## LLM Integration

- Provider: OpenRouter → Cerebras (`openrouter/openai/gpt-oss-120b`)
- Structured output via `litellm.acompletion` with a Pydantic `LLMResponse` model
- Each request includes: system prompt with live portfolio context + last 10 messages
- Auto-executes any `trades` or `watchlist_changes` returned in the response
- `LLM_MOCK=true` returns a deterministic stub (for tests / no-key dev)

## Environment Variables

```
OPENROUTER_API_KEY=   # required for chat
MASSIVE_API_KEY=      # optional — enables real market data via Polygon.io
LLM_MOCK=false        # set "true" for deterministic LLM responses
DB_PATH=              # optional override for SQLite path
```

## Running Locally

```bash
# Copy and fill in your API key
cp .env.example .env

cd backend
uv run uvicorn app.main:app --reload --port 8000
```

Server at `http://localhost:8000`. All API endpoints available immediately.

## Verified

Manually tested on 2026-05-22:

- `GET /api/health` → `{"status": "ok"}`
- `GET /api/watchlist` → 10 tickers with live prices (GBM simulator running)
- `GET /api/portfolio` → `$10,000 cash, no positions`
- `POST /api/portfolio/trade` `{ticker: AAPL, quantity: 5, side: buy}` → position created, cash deducted, portfolio snapshot recorded

## What's Next

Frontend (Next.js static export):
- SSE consumer (`EventSource` → `/api/stream/prices`)
- Watchlist grid with price flash animations and sparklines
- Portfolio heatmap, P&L chart, positions table
- Trade bar and AI chat panel
- Built as static export served by FastAPI on the same port
