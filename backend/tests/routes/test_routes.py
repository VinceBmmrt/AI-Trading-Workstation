"""API route tests using FastAPI TestClient with an in-memory SQLite DB."""

from __future__ import annotations

import os
import tempfile
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.market.cache import PriceCache  # noqa: E402
from app.routes import health, portfolio, watchlist  # noqa: E402
from fastapi import FastAPI  # noqa: E402


def _make_market_source() -> MagicMock:
    source = MagicMock()
    source.add_ticker = AsyncMock()
    source.remove_ticker = AsyncMock()
    return source


@pytest.fixture()
def client(tmp_path):
    """Fresh isolated DB + TestClient for each test."""
    db_file = tmp_path / "test.db"
    os.environ["DB_PATH"] = str(db_file)

    # Import init_db after setting DB_PATH so it uses the temp file
    from app.db import init_db
    init_db()

    price_cache = PriceCache()
    price_cache.update("AAPL", 190.0)
    price_cache.update("GOOGL", 175.0)
    price_cache.update("TSLA", 250.0)

    app = FastAPI()
    app.include_router(health.router)
    app.include_router(watchlist.router)
    app.include_router(portfolio.router)

    app.state.price_cache = price_cache
    app.state.market_source = _make_market_source()

    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Watchlist
# ---------------------------------------------------------------------------


def test_get_watchlist_returns_list(client):
    r = client.get("/api/watchlist")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    tickers = [item["ticker"] for item in data]
    assert "AAPL" in tickers


def test_add_ticker(client):
    r = client.post("/api/watchlist", json={"ticker": "AMZN"})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["ticker"] == "AMZN"


def test_add_ticker_invalid_rejected(client):
    r = client.post("/api/watchlist", json={"ticker": "TOOLONG123"})
    assert r.status_code == 400


def test_delete_ticker(client):
    # First add so we can delete it
    client.post("/api/watchlist", json={"ticker": "NFLX"})
    r = client.delete("/api/watchlist/NFLX")
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_delete_ticker_not_found(client):
    r = client.delete("/api/watchlist/ZZZZ")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------


def test_get_portfolio(client):
    r = client.get("/api/portfolio")
    assert r.status_code == 200
    body = r.json()
    assert "cash_balance" in body
    assert "positions" in body
    assert "total_value" in body
    assert body["cash_balance"] == pytest.approx(10000.0)


def test_buy_trade_success(client):
    r = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["trade"]["ticker"] == "AAPL"
    assert body["trade"]["side"] == "buy"
    assert body["portfolio"]["cash_balance"] < 10000.0


def test_buy_insufficient_cash(client):
    r = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1_000_000}
    )
    assert r.status_code == 400


def test_sell_more_than_owned(client):
    r = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 1})
    assert r.status_code == 400


def test_sell_after_buy(client):
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 2})
    r = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 1})
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_get_portfolio_history(client):
    r = client.get("/api/portfolio/history")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
