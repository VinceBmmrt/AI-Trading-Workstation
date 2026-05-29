"""Unit tests for price alerts — DB CRUD, REST endpoints, check loop, and chat context."""

from __future__ import annotations

import asyncio
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db import get_db, init_db
from app.market.cache import PriceCache
from app.routes import alerts
from app.routes.chat import _portfolio_context

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_app(db_path, price_cache: PriceCache) -> TestClient:
    app = FastAPI()
    app.include_router(alerts.router)
    app.state.price_cache = price_cache
    return TestClient(app)


def _insert_watchlist(db_path, ticker: str) -> None:
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at) VALUES ('default', ?, datetime('now'))",
        (ticker,),
    )
    conn.commit()
    conn.close()


def _insert_alert(
    db_path,
    ticker: str,
    target_price: float,
    direction: str,
    active: int = 1,
    triggered_at: str | None = None,
) -> int:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.execute(
        "INSERT INTO price_alerts (user_id, ticker, target_price, direction, active, triggered_at, created_at) "
        "VALUES ('default', ?, ?, ?, ?, ?, ?)",
        (ticker, target_price, direction, active, triggered_at, now),
    )
    conn.commit()
    alert_id = cur.lastrowid
    conn.close()
    return alert_id


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db_path(tmp_path):
    path = tmp_path / "test.db"
    with patch.dict(os.environ, {"DB_PATH": str(path)}):
        init_db()
        yield path


@pytest.fixture
def price_cache():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    cache.update("TSLA", 250.0)
    return cache


# ---------------------------------------------------------------------------
# Test 1: GET /api/alerts returns empty list initially
# ---------------------------------------------------------------------------


class TestGetAlerts:
    def test_get_alerts_empty(self, db_path, price_cache):
        """GET /api/alerts returns an empty list when no alerts exist."""
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.get("/api/alerts")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_alerts_returns_inserted(self, db_path, price_cache):
        """GET /api/alerts returns all inserted alerts with correct fields."""
        _insert_watchlist(db_path, "AAPL")
        _insert_alert(db_path, "AAPL", 200.0, "above")
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.get("/api/alerts")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["ticker"] == "AAPL"
        assert data[0]["target_price"] == 200.0
        assert data[0]["direction"] == "above"
        assert data[0]["active"] is True


# ---------------------------------------------------------------------------
# Test 2: POST /api/alerts creates an alert
# ---------------------------------------------------------------------------


class TestCreateAlert:
    def test_create_alert_success(self, db_path, price_cache):
        """POST /api/alerts creates an alert when ticker is in watchlist."""
        _insert_watchlist(db_path, "AAPL")
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.post(
                "/api/alerts",
                json={"ticker": "AAPL", "target_price": 200.0, "direction": "above"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["alert"]["ticker"] == "AAPL"
        assert body["alert"]["active"] is True

    def test_create_alert_ticker_not_in_watchlist(self, db_path, price_cache):
        """POST /api/alerts returns 400 when ticker is not in watchlist."""
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            # PYPL is not seeded into the default watchlist
            resp = client.post(
                "/api/alerts",
                json={"ticker": "PYPL", "target_price": 80.0, "direction": "above"},
            )
        assert resp.status_code == 400
        assert "watchlist" in resp.json()["detail"].lower()

    def test_create_alert_invalid_direction(self, db_path, price_cache):
        """POST /api/alerts returns 400 on invalid direction."""
        _insert_watchlist(db_path, "AAPL")
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.post(
                "/api/alerts",
                json={"ticker": "AAPL", "target_price": 200.0, "direction": "sideways"},
            )
        assert resp.status_code == 400

    def test_create_alert_negative_price(self, db_path, price_cache):
        """POST /api/alerts returns 400 when target_price <= 0."""
        _insert_watchlist(db_path, "AAPL")
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.post(
                "/api/alerts",
                json={"ticker": "AAPL", "target_price": -5.0, "direction": "above"},
            )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Test 3: DELETE /api/alerts/{id}
# ---------------------------------------------------------------------------


class TestDeleteAlert:
    def test_delete_alert_success(self, db_path, price_cache):
        """DELETE /api/alerts/{id} removes the alert and returns success."""
        _insert_watchlist(db_path, "AAPL")
        alert_id = _insert_alert(db_path, "AAPL", 200.0, "above")
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.delete(f"/api/alerts/{alert_id}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        # Verify removed
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp2 = client.get("/api/alerts")
        assert resp2.json() == []

    def test_delete_nonexistent_alert_returns_404(self, db_path, price_cache):
        """DELETE /api/alerts/{id} returns 404 for missing alert."""
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.delete("/api/alerts/9999")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Test 4: Alert check loop fires 'above' alert
# ---------------------------------------------------------------------------


class TestAlertCheckLoop:
    def test_alert_fires_above(self, db_path, price_cache):
        """_alert_check_loop fires an alert when price crosses above threshold."""
        from app.main import _alert_check_loop

        _insert_watchlist(db_path, "AAPL")
        _insert_alert(db_path, "AAPL", 195.0, "above", active=1)

        queue: asyncio.Queue = asyncio.Queue()

        async def _run():
            task = asyncio.create_task(_alert_check_loop(price_cache, queue))
            await asyncio.sleep(1.2)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # price=190.0 (below threshold) — should NOT fire
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            asyncio.run(_run())

        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT active FROM price_alerts WHERE ticker='AAPL'"
        ).fetchone()
        conn.close()
        assert row[0] == 1  # still active

        # price=196.0 (above threshold) — SHOULD fire
        price_cache.update("AAPL", 196.0)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            asyncio.run(_run())

        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT active FROM price_alerts WHERE ticker='AAPL'"
        ).fetchone()
        conn.close()
        assert row[0] == 0  # fired and deactivated

    def test_alert_fires_below(self, db_path, price_cache):
        """_alert_check_loop fires an alert when price crosses below threshold."""
        from app.main import _alert_check_loop

        _insert_watchlist(db_path, "TSLA")
        _insert_alert(db_path, "TSLA", 260.0, "below", active=1)

        queue: asyncio.Queue = asyncio.Queue()

        async def _run():
            task = asyncio.create_task(_alert_check_loop(price_cache, queue))
            await asyncio.sleep(1.2)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # price=250.0 (below 260.0 threshold) — SHOULD fire
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            asyncio.run(_run())

        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT active FROM price_alerts WHERE ticker='TSLA'"
        ).fetchone()
        conn.close()
        assert row[0] == 0  # fired

        # Queue should contain the fired event
        assert not queue.empty()
        event = queue.get_nowait()
        assert event["ticker"] == "TSLA"
        assert event["direction"] == "below"


# ---------------------------------------------------------------------------
# Test 5 & 6: Alert context in _portfolio_context
# ---------------------------------------------------------------------------


class TestAlertContextInPortfolioContext:
    def test_alert_context_in_portfolio(self, db_path, price_cache):
        """Recent fired alerts appear in _portfolio_context output."""
        recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        _insert_alert(db_path, "AAPL", 190.0, "above", active=0, triggered_at=recent)

        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            result = _portfolio_context(price_cache)

        assert "Recent price alerts fired" in result
        assert "AAPL" in result

    def test_alert_context_old_excluded(self, db_path, price_cache):
        """Fired alerts older than 30 min do NOT appear in _portfolio_context."""
        old = (datetime.now(timezone.utc) - timedelta(minutes=35)).isoformat()
        _insert_alert(db_path, "AAPL", 190.0, "above", active=0, triggered_at=old)

        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            result = _portfolio_context(price_cache)

        assert "Recent price alerts fired" not in result
