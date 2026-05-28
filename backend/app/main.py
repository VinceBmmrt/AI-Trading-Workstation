"""AI Trading Workstation — FastAPI application entry point."""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env before any module reads os.environ
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from litellm import acompletion  # noqa: E402

from .db import DEFAULT_TICKERS, get_db, init_db, take_snapshot  # noqa: E402
from .market import PriceCache, create_market_data_source, create_stream_router  # noqa: E402
from .routes import chat, health, portfolio, watchlist  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

# Shared price cache — created at import time so the stream router closure captures it
_price_cache = PriceCache()

ALERT_THRESHOLD_PCT = 2.0
ALERT_COOLDOWN_SEC = 600
_alert_semaphore = asyncio.Semaphore(1)


async def _generate_proactive_alert(
    ticker: str, session_pct: float, price: float, price_cache: PriceCache
) -> None:
    """Generate and save a proactive market alert message."""
    async with _alert_semaphore:
        try:
            canned = (
                f"Market alert: {ticker} moved {session_pct:+.1f}% this session "
                f"(now ${price:.2f})."
            )
            if os.environ.get("LLM_MOCK", "").lower() == "true":
                content = canned
            else:
                with get_db() as conn:
                    row = conn.execute(
                        "SELECT quantity FROM positions WHERE user_id='default' AND ticker=?",
                        (ticker,),
                    ).fetchone()
                qty = row["quantity"] if row else 0

                direction = "up" if session_pct > 0 else "down"
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are Finance Ally. Be very brief — 1-2 sentences. "
                            "Plain text only, no JSON."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"{ticker} just moved {session_pct:+.1f}% {direction} this session "
                            f"(now ${price:.2f}). The user holds {qty} shares. "
                            "Note this briefly."
                        ),
                    },
                ]
                try:
                    resp = await acompletion(
                        model=chat.MODEL,
                        messages=messages,
                        reasoning_effort="low",
                        extra_body=chat.EXTRA_BODY,
                    )
                    content = resp.choices[0].message.content.strip()
                except Exception:
                    logger.exception("Proactive LLM call failed for %s", ticker)
                    content = canned

            chat._save_message(
                "assistant",
                content,
                {
                    "proactive": True,
                    "ticker": ticker,
                    "trades": [],
                    "trade_errors": [],
                    "watchlist_changes": [],
                },
            )
        except Exception:
            logger.exception("Failed to generate proactive alert for %s", ticker)


async def _proactive_monitor_loop(price_cache: PriceCache, baselines: dict[str, float]) -> None:
    """Monitor session moves; trigger AI commentary on >2% moves."""
    last_alerted: dict[str, float] = {}
    while True:
        await asyncio.sleep(3.0)
        try:
            now = asyncio.get_running_loop().time()
            for ticker, update in price_cache.get_all().items():
                baseline = baselines.get(ticker, 0.0)
                if baseline == 0.0:
                    continue
                session_pct = (update.price - baseline) / baseline * 100
                if abs(session_pct) < ALERT_THRESHOLD_PCT:
                    continue
                if now - last_alerted.get(ticker, 0.0) < ALERT_COOLDOWN_SEC:
                    continue
                last_alerted[ticker] = now
                asyncio.create_task(
                    _generate_proactive_alert(ticker, session_pct, update.price, price_cache)
                )
        except Exception:
            logger.exception("Proactive monitor error")


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

    # Allow first price tick to populate the cache before capturing baselines
    await asyncio.sleep(0.6)
    baselines = {t: (_price_cache.get_price(t) or 0.0) for t in tickers}
    app.state.session_baselines = baselines

    app.state.price_cache = _price_cache
    app.state.market_source = source

    snapshot_task = asyncio.create_task(_snapshot_loop(_price_cache), name="snapshot-loop")
    monitor_task = asyncio.create_task(
        _proactive_monitor_loop(_price_cache, app.state.session_baselines),
        name="proactive-monitor",
    )

    yield

    snapshot_task.cancel()
    try:
        await snapshot_task
    except asyncio.CancelledError:
        pass

    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass

    await source.stop()
    logger.info("Shutdown complete")


app = FastAPI(title="AI Trading Workstation", lifespan=lifespan)

# Allow the Next.js dev server (port 3000) to reach the API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(create_stream_router(_price_cache))
app.include_router(watchlist.router)
app.include_router(portfolio.router)
app.include_router(chat.router)

# Serve static Next.js export if it exists (production / Docker)
_static_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "out"
if _static_dir.exists():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
