"""Tests for Phase 10 — enriched context, proactive alerts, messages endpoint, market-summary."""

from __future__ import annotations

import asyncio
import json
import os
import sqlite3
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db import init_db
from app.market.cache import PriceCache
from app.routes.chat import STARTING_CAPITAL, _portfolio_context, router

# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


def _make_app(price_cache: PriceCache, session_baselines=None) -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    ms = AsyncMock()
    ms.add_ticker = AsyncMock()
    ms.remove_ticker = AsyncMock()
    app.state.price_cache = price_cache
    app.state.market_source = ms
    if session_baselines is not None:
        app.state.session_baselines = session_baselines
    return app


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


def _insert_position(db_path, ticker: str, qty: float, avg_cost: float):
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT OR REPLACE INTO positions (user_id, ticker, quantity, avg_cost, updated_at) "
        "VALUES ('default', ?, ?, ?, datetime('now'))",
        (ticker, qty, avg_cost),
    )
    conn.commit()
    conn.close()


def _insert_watchlist(db_path, ticker: str):
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at) VALUES ('default', ?, datetime('now'))",
        (ticker,),
    )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Enriched _portfolio_context
# ---------------------------------------------------------------------------


class TestEnrichedPortfolioContext:
    def test_concentration_marker_above_25pct(self, db_path, price_cache):
        """A position worth >25% of total portfolio appends the concentrated marker."""
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            # AAPL @ $190, qty=20 = $3800 value
            # cash=$10000, total=$13800, weight=3800/13800=27.5% -> concentrated
            _insert_position(db_path, "AAPL", 20, 180.0)
            result = _portfolio_context(price_cache)

        assert "concentrated" in result

    def test_no_concentration_marker_below_25pct(self, db_path, price_cache):
        """A position worth <=25% of total does not get the concentrated marker."""
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            # AAPL @ $190, qty=5 = $950
            # cash=$10000, total=$10950, weight=950/10950=8.7% -> not concentrated
            _insert_position(db_path, "AAPL", 5, 180.0)
            result = _portfolio_context(price_cache)

        assert "concentrated" not in result

    def test_session_movers_block_present_with_baselines(self, db_path, price_cache):
        """Session movers block appears when baselines are provided."""
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            _insert_watchlist(db_path, "AAPL")
            # AAPL baseline=$180, now=$190 -> +5.6% session
            baselines = {"AAPL": 180.0}
            result = _portfolio_context(price_cache, baselines)

        assert "Session movers" in result
        assert "AAPL" in result

    def test_no_movers_block_when_baselines_none(self, db_path, price_cache):
        """No session movers block when baselines=None."""
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            result = _portfolio_context(price_cache, None)

        assert "Session movers" not in result

    def test_delta_vs_starting_capital_in_header(self, db_path, price_cache):
        """Header includes starting capital and delta."""
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            result = _portfolio_context(price_cache)

        assert f"${STARTING_CAPITAL:.2f}" in result
        assert "change:" in result

    def test_portfolio_context_accepts_old_single_arg_call(self, db_path, price_cache):
        """Existing callers passing only price_cache still work (session_baselines defaults None)."""
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            result = _portfolio_context(price_cache)

        assert "Cash:" in result


# ---------------------------------------------------------------------------
# Proactive alert — LLM_MOCK=true
# ---------------------------------------------------------------------------


class TestProactiveAlert:
    def test_mock_mode_inserts_proactive_row_without_network(self, db_path, price_cache):
        """Under LLM_MOCK=true, _generate_proactive_alert inserts exactly one row with proactive=true."""
        from app.main import _generate_proactive_alert

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            with patch("app.routes.chat.acompletion") as mock_llm:
                asyncio.run(_generate_proactive_alert("AAPL", 3.5, 197.0, price_cache))

        mock_llm.assert_not_called()

        conn = sqlite3.connect(str(db_path))
        rows = conn.execute(
            "SELECT role, actions FROM chat_messages WHERE user_id='default'"
        ).fetchall()
        conn.close()

        assert len(rows) == 1
        role, actions_json = rows[0]
        assert role == "assistant"
        actions = json.loads(actions_json)
        assert actions["proactive"] is True
        assert actions["ticker"] == "AAPL"

    def test_canned_message_includes_ticker_and_pct(self, db_path, price_cache):
        """The canned mock message includes the ticker symbol and session % with sign."""
        from app.main import _generate_proactive_alert

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            asyncio.run(_generate_proactive_alert("TSLA", -2.8, 243.0, price_cache))

        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT content FROM chat_messages WHERE user_id='default' ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        conn.close()

        content = row[0]
        assert "TSLA" in content
        assert "-2.8%" in content


# ---------------------------------------------------------------------------
# Cooldown logic
# ---------------------------------------------------------------------------


class TestCooldownLogic:
    def test_cooldown_blocks_second_alert_for_same_ticker(self):
        """Simulating the loop body twice with the same 'now' fires only once per ticker."""
        from app.main import ALERT_COOLDOWN_SEC, ALERT_THRESHOLD_PCT

        last_alerted: dict[str, float] = {}
        fire_log: list[str] = []

        def simulate_body(ticker: str, baseline: float, current: float, now: float):
            if baseline == 0.0:
                return
            session_pct = (current - baseline) / baseline * 100
            if abs(session_pct) < ALERT_THRESHOLD_PCT:
                return
            if now - last_alerted.get(ticker, 0.0) < ALERT_COOLDOWN_SEC:
                return
            last_alerted[ticker] = now
            fire_log.append(ticker)

        now = 1000.0
        # 5% above baseline — exceeds 2% threshold
        simulate_body("AAPL", 100.0, 105.0, now)
        simulate_body("AAPL", 100.0, 105.0, now)  # same 'now' — within cooldown

        assert len(fire_log) == 1
        assert fire_log[0] == "AAPL"

    def test_different_tickers_each_fire_once(self):
        """Two different tickers exceeding the threshold each fire once independently."""
        from app.main import ALERT_COOLDOWN_SEC, ALERT_THRESHOLD_PCT

        last_alerted: dict[str, float] = {}
        fire_log: list[str] = []

        def simulate_body(ticker: str, baseline: float, current: float, now: float):
            if baseline == 0.0:
                return
            session_pct = (current - baseline) / baseline * 100
            if abs(session_pct) < ALERT_THRESHOLD_PCT:
                return
            if now - last_alerted.get(ticker, 0.0) < ALERT_COOLDOWN_SEC:
                return
            last_alerted[ticker] = now
            fire_log.append(ticker)

        now = 1000.0
        simulate_body("AAPL", 100.0, 105.0, now)
        simulate_body("TSLA", 100.0, 108.0, now)

        assert sorted(fire_log) == ["AAPL", "TSLA"]

    def test_below_threshold_does_not_fire(self):
        """A move below ALERT_THRESHOLD_PCT never schedules an alert."""
        from app.main import ALERT_COOLDOWN_SEC, ALERT_THRESHOLD_PCT

        last_alerted: dict[str, float] = {}
        fire_log: list[str] = []

        def simulate_body(ticker: str, baseline: float, current: float, now: float):
            if baseline == 0.0:
                return
            session_pct = (current - baseline) / baseline * 100
            if abs(session_pct) < ALERT_THRESHOLD_PCT:
                return
            if now - last_alerted.get(ticker, 0.0) < ALERT_COOLDOWN_SEC:
                return
            last_alerted[ticker] = now
            fire_log.append(ticker)

        simulate_body("AAPL", 100.0, 101.0, 1000.0)  # only 1% move

        assert fire_log == []


# ---------------------------------------------------------------------------
# GET /api/chat/messages endpoint
# ---------------------------------------------------------------------------


class TestMessagesEndpoint:
    def test_empty_when_no_messages(self, db_path, price_cache):
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.get("/api/chat/messages")

        assert resp.status_code == 200
        assert resp.json() == []

    def test_after_ts_filters_older_messages(self, db_path, price_cache):
        """Messages older than after_ts are excluded from the response."""
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            # Post two chat messages to create DB rows
            client.post("/api/chat", json={"message": "first"})

            # Capture a cutoff timestamp
            cutoff = datetime.now(timezone.utc).isoformat()

            client.post("/api/chat", json={"message": "second"})

            resp = client.get(f"/api/chat/messages?after_ts={cutoff}")

        assert resp.status_code == 200
        msgs = resp.json()
        # Only rows created after cutoff should appear (the 2nd pair: user + assistant)
        assert len(msgs) >= 1
        for msg in msgs:
            assert msg["created_at"] > cutoff

    def test_no_after_ts_returns_max_20_ascending(self, db_path, price_cache):
        """Without after_ts, returns <=20 messages ordered ascending by created_at."""
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            for _ in range(5):
                client.post("/api/chat", json={"message": "ping"})
            resp = client.get("/api/chat/messages")

        assert resp.status_code == 200
        msgs = resp.json()
        assert len(msgs) <= 20
        # Ascending order
        timestamps = [m["created_at"] for m in msgs]
        assert timestamps == sorted(timestamps)

    def test_proactive_message_has_proactive_true_in_actions(self, db_path, price_cache):
        """A proactive message returned by the endpoint has actions.proactive == true."""
        from app.main import _generate_proactive_alert

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            asyncio.run(_generate_proactive_alert("NVDA", 4.0, 600.0, price_cache))

            app = _make_app(price_cache)
            client = TestClient(app)
            resp = client.get("/api/chat/messages")

        assert resp.status_code == 200
        msgs = resp.json()
        proactive = [m for m in msgs if m.get("actions") and m["actions"].get("proactive")]
        assert len(proactive) == 1
        assert proactive[0]["actions"]["ticker"] == "NVDA"


# ---------------------------------------------------------------------------
# GET /api/chat/market-summary endpoint
# ---------------------------------------------------------------------------


class TestMarketSummaryEndpoint:
    def test_mock_mode_returns_200_with_non_empty_summary(self, db_path, price_cache):
        app = _make_app(price_cache, session_baselines={"AAPL": 185.0})
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            resp = client.get("/api/chat/market-summary")

        assert resp.status_code == 200
        body = resp.json()
        assert "summary" in body
        assert isinstance(body["summary"], str)
        assert len(body["summary"]) > 0
        assert "generated_at" in body

    def test_never_500_when_llm_raises(self, db_path, price_cache):
        """Even if acompletion raises, the endpoint returns HTTP 200 with a fallback."""
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch(
                "app.routes.chat.acompletion",
                new=AsyncMock(side_effect=Exception("network error")),
            ):
                resp = client.get("/api/chat/market-summary")

        assert resp.status_code == 200
        body = resp.json()
        assert "summary" in body
        assert len(body["summary"]) > 0

    def test_mock_mode_does_not_call_llm(self, db_path, price_cache):
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            with patch("app.routes.chat.acompletion") as mock_llm:
                resp = client.get("/api/chat/market-summary")

        assert resp.status_code == 200
        mock_llm.assert_not_called()
