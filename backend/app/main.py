"""AI Trading Workstation — FastAPI application entry point."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env before any module reads os.environ
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from .db import DEFAULT_TICKERS, get_db, init_db, take_snapshot  # noqa: E402
from .market import PriceCache, create_market_data_source, create_stream_router  # noqa: E402
from .routes import chat, health, portfolio, watchlist  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

# Shared price cache — created at import time so the stream router closure captures it
_price_cache = PriceCache()


async def _snapshot_loop(price_cache: PriceCache) -> None:
    """Take a portfolio snapshot every 30 seconds."""
    while True:
        await asyncio.sleep(30.0)
        try:
            take_snapshot("default", price_cache)
        except Exception:
            logger.exception("Portfolio snapshot failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database initialized")

    source = create_market_data_source(_price_cache)

    with get_db() as conn:
        rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id='default'"
        ).fetchall()
    tickers = [r["ticker"] for r in rows] or list(DEFAULT_TICKERS)

    await source.start(tickers)
    logger.info("Market data started: %s", tickers)

    app.state.price_cache = _price_cache
    app.state.market_source = source

    snapshot_task = asyncio.create_task(_snapshot_loop(_price_cache), name="snapshot-loop")

    yield

    snapshot_task.cancel()
    try:
        await snapshot_task
    except asyncio.CancelledError:
        pass

    await source.stop()
    logger.info("Shutdown complete")


app = FastAPI(title="AI Trading Workstation", lifespan=lifespan)

app.include_router(health.router)
app.include_router(create_stream_router(_price_cache))
app.include_router(watchlist.router)
app.include_router(portfolio.router)
app.include_router(chat.router)

# Serve static Next.js export if it exists (production / Docker)
_static_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "out"
if _static_dir.exists():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
