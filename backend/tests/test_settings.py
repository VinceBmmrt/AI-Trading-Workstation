from __future__ import annotations

import os
import sqlite3
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db import get_db, init_db
from app.market.cache import PriceCache
from app.routes import portfolio, settings


def _make_app(db_path, price_cache):
    app = FastAPI()
    app.include_router(settings.router)
    app.include_router(portfolio.router)
    app.state.price_cache = price_cache
    return TestClient(app)


def _insert_position(db_path):
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT INTO positions (user_id, ticker, quantity, avg_cost, updated_at) VALUES ('default', 'AAPL', 1, 100.0, '2026-01-01')"
    )
    conn.commit()
    conn.close()


def _insert_trade(db_path):
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) VALUES ('t1', 'default', 'AAPL', 'buy', 1, 100.0, '2026-01-01')"
    )
    conn.commit()
    conn.close()


def _insert_snapshot(db_path):
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT INTO portfolio_snapshots (user_id, total_value, recorded_at) VALUES ('default', 10000.0, '2026-01-01')"
    )
    conn.commit()
    conn.close()


def _insert_chat(db_path):
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT INTO chat_messages (id, user_id, role, content, created_at) VALUES ('c1', 'default', 'user', 'hello', '2026-01-01')"
    )
    conn.commit()
    conn.close()


def _insert_alert_row(db_path):
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT INTO price_alerts (user_id, ticker, target_price, direction, active, created_at) VALUES ('default', 'AAPL', 200.0, 'above', 1, '2026-01-01')"
    )
    conn.commit()
    conn.close()


@pytest.fixture
def db_path(tmp_path):
    path = tmp_path / "test.db"
    with patch.dict(os.environ, {"DB_PATH": str(path)}):
        init_db()
        yield path


@pytest.fixture
def price_cache():
    pc = PriceCache()
    pc.update("AAPL", 190.0)
    return pc


class TestSettings:
    def test_settings_get_default(self, db_path, price_cache):
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.get("/api/settings")
        assert resp.status_code == 200
        assert resp.json()["starting_capital"] == 10000.0

    def test_settings_put_valid(self, db_path, price_cache):
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.put("/api/settings", json={"starting_capital": 25000.0})
        assert resp.status_code == 200
        assert resp.json()["starting_capital"] == 25000.0

    def test_settings_put_invalid_zero(self, db_path, price_cache):
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.put("/api/settings", json={"starting_capital": 0})
        assert resp.status_code == 422

    def test_settings_put_invalid_negative(self, db_path, price_cache):
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.put("/api/settings", json={"starting_capital": -100})
        assert resp.status_code == 422

    def test_settings_persists_across_get(self, db_path, price_cache):
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            client.put("/api/settings", json={"starting_capital": 25000.0})
            resp = client.get("/api/settings")
        assert resp.json()["starting_capital"] == 25000.0


class TestReset:
    def test_portfolio_reset_clears_positions(self, db_path, price_cache):
        _insert_position(db_path)
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.post("/api/portfolio/reset")
        assert resp.status_code == 200
        conn = sqlite3.connect(str(db_path))
        count = conn.execute("SELECT COUNT(*) FROM positions WHERE user_id='default'").fetchone()[0]
        conn.close()
        assert count == 0

    def test_portfolio_reset_clears_trades(self, db_path, price_cache):
        _insert_trade(db_path)
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.post("/api/portfolio/reset")
        assert resp.status_code == 200
        conn = sqlite3.connect(str(db_path))
        count = conn.execute("SELECT COUNT(*) FROM trades WHERE user_id='default'").fetchone()[0]
        conn.close()
        assert count == 0

    def test_portfolio_reset_clears_snapshots(self, db_path, price_cache):
        _insert_snapshot(db_path)
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.post("/api/portfolio/reset")
        assert resp.status_code == 200
        conn = sqlite3.connect(str(db_path))
        count = conn.execute("SELECT COUNT(*) FROM portfolio_snapshots WHERE user_id='default'").fetchone()[0]
        conn.close()
        assert count == 0

    def test_portfolio_reset_restores_cash(self, db_path, price_cache):
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.post("/api/portfolio/reset")
        assert resp.status_code == 200
        conn = sqlite3.connect(str(db_path))
        row = conn.execute("SELECT cash_balance FROM users_profile WHERE id='default'").fetchone()
        conn.close()
        assert row[0] == 10000.0

    def test_portfolio_reset_uses_configured_capital(self, db_path, price_cache):
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            client.put("/api/settings", json={"starting_capital": 25000.0})
            resp = client.post("/api/portfolio/reset")
        assert resp.status_code == 200
        assert resp.json()["cash_balance"] == 25000.0
        conn = sqlite3.connect(str(db_path))
        row = conn.execute("SELECT cash_balance FROM users_profile WHERE id='default'").fetchone()
        conn.close()
        assert row[0] == 25000.0

    def test_portfolio_reset_preserves_chat(self, db_path, price_cache):
        _insert_chat(db_path)
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            client.post("/api/portfolio/reset")
        conn = sqlite3.connect(str(db_path))
        count = conn.execute("SELECT COUNT(*) FROM chat_messages WHERE user_id='default'").fetchone()[0]
        conn.close()
        assert count == 1

    def test_portfolio_reset_preserves_alerts(self, db_path, price_cache):
        _insert_alert_row(db_path)
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            client.post("/api/portfolio/reset")
        conn = sqlite3.connect(str(db_path))
        count = conn.execute("SELECT COUNT(*) FROM price_alerts WHERE user_id='default'").fetchone()[0]
        conn.close()
        assert count == 1

    def test_portfolio_reset_returns_success_json(self, db_path, price_cache):
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.post("/api/portfolio/reset")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["cash_balance"] == 10000.0


class TestAnalyticsUsesDbCapital:
    def test_analytics_uses_db_starting_capital(self, db_path, price_cache):
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            client.put("/api/settings", json={"starting_capital": 25000.0})
            # Reset so cash = 25000 (starting capital)
            client.post("/api/portfolio/reset")
            resp = client.get("/api/portfolio/analytics")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_return_pct"] == 0.0
