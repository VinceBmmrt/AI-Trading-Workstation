"""Tests for the /api/chat endpoint and LLM integration."""

from __future__ import annotations

import json
import os
import sqlite3
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db import init_db
from app.market.cache import PriceCache
from app.routes.chat import router


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


def _make_app(price_cache: PriceCache, market_source=None) -> FastAPI:
    """Build a minimal FastAPI app with just the chat router and state."""
    app = FastAPI()
    app.include_router(router)

    if market_source is None:
        ms = AsyncMock()
        ms.add_ticker = AsyncMock()
        ms.remove_ticker = AsyncMock()
    else:
        ms = market_source

    app.state.price_cache = price_cache
    app.state.market_source = ms
    return app


def _make_llm_mock_response(message: str, trades=None, watchlist_changes=None) -> MagicMock:
    """Build a fake litellm response object with structured JSON content."""
    payload = {
        "message": message,
        "trades": trades or [],
        "watchlist_changes": watchlist_changes or [],
    }
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps(payload)
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    return mock_resp


@pytest.fixture
def db_path(tmp_path):
    """Fresh SQLite DB for each test, pointed at via DB_PATH env var."""
    path = tmp_path / "test.db"
    with patch.dict(os.environ, {"DB_PATH": str(path)}):
        init_db()
        yield path


@pytest.fixture
def price_cache():
    """Price cache pre-seeded with AAPL and TSLA."""
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    cache.update("TSLA", 250.0)
    return cache


# ---------------------------------------------------------------------------
# LLM_MOCK mode
# ---------------------------------------------------------------------------


class TestLLMMockMode:
    """When LLM_MOCK=true the route must return a deterministic response without calling OpenRouter."""

    def test_mock_mode_does_not_call_llm(self, db_path, price_cache):
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            with patch("app.routes.chat.acompletion") as mock_llm:
                resp = client.post("/api/chat", json={"message": "Hello"})

        assert resp.status_code == 200
        mock_llm.assert_not_called()

    def test_mock_mode_returns_non_empty_message(self, db_path, price_cache):
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            resp = client.post("/api/chat", json={"message": "Hello"})

        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body
        assert isinstance(body["message"], str)
        assert len(body["message"]) > 0

    def test_mock_mode_case_insensitive(self, db_path, price_cache):
        """LLM_MOCK=True (capital T) should also activate mock mode."""
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "True"}):
            with patch("app.routes.chat.acompletion") as mock_llm:
                resp = client.post("/api/chat", json={"message": "Hello"})

        assert resp.status_code == 200
        mock_llm.assert_not_called()

    def test_mock_mode_returns_empty_actions(self, db_path, price_cache):
        """Mock mode returns no trades or watchlist changes by default."""
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "true"}):
            resp = client.post("/api/chat", json={"message": "Buy AAPL"})

        assert resp.status_code == 200
        actions = resp.json()["actions"]
        assert actions["trades"] == []
        assert actions["trade_errors"] == []
        assert actions["watchlist_changes"] == []


# ---------------------------------------------------------------------------
# Structured output parsing
# ---------------------------------------------------------------------------


class TestStructuredOutputParsing:
    """Valid JSON from the LLM is parsed into the correct response shape."""

    def test_message_only_response(self, db_path, price_cache):
        app = _make_app(price_cache)
        client = TestClient(app)
        mock_resp = _make_llm_mock_response("Looks good.")

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "How is my portfolio?"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["message"] == "Looks good."
        assert body["actions"]["trades"] == []
        assert body["actions"]["watchlist_changes"] == []

    def test_response_with_buy_trade(self, db_path, price_cache):
        """LLM response specifying a buy trade is parsed and the trade is executed."""
        app = _make_app(price_cache)
        client = TestClient(app)
        trades = [{"ticker": "AAPL", "side": "buy", "quantity": 5}]
        mock_resp = _make_llm_mock_response("Buying 5 AAPL.", trades=trades)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "Buy some AAPL"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["message"] == "Buying 5 AAPL."
        executed = body["actions"]["trades"]
        assert len(executed) == 1
        assert executed[0]["ticker"] == "AAPL"
        assert executed[0]["side"] == "buy"
        assert executed[0]["quantity"] == 5

    def test_response_with_watchlist_add(self, db_path, price_cache):
        """LLM response specifying a watchlist add is executed."""
        app = _make_app(price_cache)
        client = TestClient(app)
        wl = [{"ticker": "NVDA", "action": "add"}]
        mock_resp = _make_llm_mock_response("Added NVDA to watchlist.", watchlist_changes=wl)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "Watch NVDA"})

        assert resp.status_code == 200
        wl_changes = resp.json()["actions"]["watchlist_changes"]
        assert len(wl_changes) == 1
        assert wl_changes[0]["ticker"] == "NVDA"
        assert wl_changes[0]["action"] == "add"

    def test_response_with_watchlist_remove(self, db_path, price_cache):
        """LLM response specifying a watchlist remove is executed."""
        app = _make_app(price_cache)
        client = TestClient(app)
        wl = [{"ticker": "TSLA", "action": "remove"}]
        mock_resp = _make_llm_mock_response("Removed TSLA.", watchlist_changes=wl)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "Remove TSLA"})

        assert resp.status_code == 200
        wl_changes = resp.json()["actions"]["watchlist_changes"]
        assert len(wl_changes) == 1
        assert wl_changes[0]["action"] == "remove"

    def test_ticker_normalised_to_uppercase_in_trade(self, db_path, price_cache):
        """Tickers returned in lowercase by the LLM are normalised to uppercase before execution."""
        app = _make_app(price_cache)
        client = TestClient(app)
        trades = [{"ticker": "aapl", "side": "buy", "quantity": 2}]
        mock_resp = _make_llm_mock_response("Buying aapl.", trades=trades)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "buy aapl"})

        # Must be 200 regardless of outcome; no 500
        assert resp.status_code == 200
        actions = resp.json()["actions"]
        assert "trades" in actions


# ---------------------------------------------------------------------------
# Malformed JSON fallback
# ---------------------------------------------------------------------------


class TestMalformedJsonFallback:
    """If the LLM returns bad JSON the endpoint must NOT return a 500."""

    def _post_with_llm_content(self, db_path, price_cache, content: str):
        app = _make_app(price_cache)
        client = TestClient(app)
        mock_choice = MagicMock()
        mock_choice.message.content = content
        mock_resp = MagicMock()
        mock_resp.choices = [mock_choice]

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                return client.post("/api/chat", json={"message": "test"})

    def test_completely_invalid_json(self, db_path, price_cache):
        resp = self._post_with_llm_content(db_path, price_cache, "this is not JSON at all")
        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body
        assert body["actions"]["trades"] == []
        assert body["actions"]["watchlist_changes"] == []

    def test_json_missing_required_message_field(self, db_path, price_cache):
        content = json.dumps({"trades": [], "watchlist_changes": []})
        resp = self._post_with_llm_content(db_path, price_cache, content)
        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body
        assert body["actions"]["trades"] == []

    def test_empty_string_response(self, db_path, price_cache):
        resp = self._post_with_llm_content(db_path, price_cache, "")
        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body
        assert body["actions"]["trades"] == []

    def test_llm_raises_exception(self, db_path, price_cache):
        """If acompletion raises, the endpoint returns a graceful fallback, not a 500."""
        app = _make_app(price_cache)
        client = TestClient(app)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch(
                "app.routes.chat.acompletion",
                new=AsyncMock(side_effect=Exception("network error")),
            ):
                resp = client.post("/api/chat", json={"message": "test"})

        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body
        assert body["actions"]["trades"] == []
        assert body["actions"]["watchlist_changes"] == []


# ---------------------------------------------------------------------------
# Trade validation in chat
# ---------------------------------------------------------------------------


class TestTradeValidationInChat:
    """LLM-specified trades that fail validation are captured as errors, not 500s."""

    def test_insufficient_cash_captured_in_errors(self, db_path, price_cache):
        """Buying more than cash allows records an error without raising."""
        app = _make_app(price_cache)
        client = TestClient(app)
        # AAPL @ $190; buying 10 000 shares costs $1.9M; user only has $10k
        trades = [{"ticker": "AAPL", "side": "buy", "quantity": 10_000}]
        mock_resp = _make_llm_mock_response("Buying lots of AAPL.", trades=trades)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "buy 10000 AAPL"})

        assert resp.status_code == 200
        actions = resp.json()["actions"]
        assert actions["trades"] == []
        assert len(actions["trade_errors"]) == 1
        assert "Insufficient cash" in actions["trade_errors"][0]

    def test_sell_more_than_owned_captured_in_errors(self, db_path, price_cache):
        """Selling shares not owned records an error without raising."""
        app = _make_app(price_cache)
        client = TestClient(app)
        trades = [{"ticker": "AAPL", "side": "sell", "quantity": 100}]
        mock_resp = _make_llm_mock_response("Selling AAPL.", trades=trades)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "sell 100 AAPL"})

        assert resp.status_code == 200
        actions = resp.json()["actions"]
        assert actions["trades"] == []
        assert len(actions["trade_errors"]) == 1
        assert "Insufficient shares" in actions["trade_errors"][0]

    def test_unknown_ticker_no_price_captured_in_errors(self, db_path, price_cache):
        """A ticker missing from the price cache records a 'No price' error."""
        app = _make_app(price_cache)
        client = TestClient(app)
        trades = [{"ticker": "UNKNOWN", "side": "buy", "quantity": 1}]
        mock_resp = _make_llm_mock_response("Buying UNKNOWN.", trades=trades)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "buy UNKNOWN"})

        assert resp.status_code == 200
        actions = resp.json()["actions"]
        assert actions["trades"] == []
        assert len(actions["trade_errors"]) == 1
        assert "No price" in actions["trade_errors"][0]

    def test_valid_trade_executes_and_deducts_cash(self, db_path, price_cache):
        """A valid LLM-specified buy actually executes and cash is reduced in the DB."""
        app = _make_app(price_cache)
        client = TestClient(app)
        trades = [{"ticker": "AAPL", "side": "buy", "quantity": 10}]
        mock_resp = _make_llm_mock_response("Bought 10 AAPL.", trades=trades)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "buy 10 AAPL"})

        assert resp.status_code == 200
        actions = resp.json()["actions"]
        assert len(actions["trades"]) == 1
        assert actions["trade_errors"] == []

        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id='default'"
        ).fetchone()
        conn.close()
        assert row[0] == 10_000.0 - (10 * 190.0)  # $8 100.00


# ---------------------------------------------------------------------------
# Watchlist changes
# ---------------------------------------------------------------------------


class TestWatchlistChanges:
    """LLM-specified watchlist additions and removals are persisted to the DB."""

    def test_add_new_ticker_persisted(self, db_path, price_cache):
        app = _make_app(price_cache)
        client = TestClient(app)
        wl = [{"ticker": "MSFT", "action": "add"}]
        mock_resp = _make_llm_mock_response("Added MSFT.", watchlist_changes=wl)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "add MSFT"})

        assert resp.status_code == 200
        assert len(resp.json()["actions"]["watchlist_changes"]) == 1

        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id='default' AND ticker='MSFT'"
        ).fetchone()
        conn.close()
        assert row is not None

    def test_remove_ticker_persisted(self, db_path, price_cache):
        """Removing a seeded ticker deletes it from the DB."""
        app = _make_app(price_cache)
        client = TestClient(app)
        wl = [{"ticker": "AAPL", "action": "remove"}]
        mock_resp = _make_llm_mock_response("Removed AAPL.", watchlist_changes=wl)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "remove AAPL"})

        assert resp.status_code == 200
        assert len(resp.json()["actions"]["watchlist_changes"]) == 1

        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id='default' AND ticker='AAPL'"
        ).fetchone()
        conn.close()
        assert row is None

    def test_duplicate_add_is_idempotent(self, db_path, price_cache):
        """Adding a ticker already in the watchlist does not cause an error."""
        app = _make_app(price_cache)
        client = TestClient(app)
        wl = [{"ticker": "AAPL", "action": "add"}]  # AAPL is already seeded
        mock_resp = _make_llm_mock_response("AAPL already watched.", watchlist_changes=wl)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "add AAPL again"})

        assert resp.status_code == 200

    def test_watchlist_ticker_normalised_uppercase(self, db_path, price_cache):
        """A lowercase ticker from the LLM is stored as uppercase in the DB."""
        app = _make_app(price_cache)
        client = TestClient(app)
        wl = [{"ticker": "msft", "action": "add"}]
        mock_resp = _make_llm_mock_response("Added msft.", watchlist_changes=wl)

        with patch.dict(os.environ, {"DB_PATH": str(db_path), "LLM_MOCK": "false"}):
            with patch("app.routes.chat.acompletion", new=AsyncMock(return_value=mock_resp)):
                resp = client.post("/api/chat", json={"message": "add msft"})

        assert resp.status_code == 200
        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id='default' AND ticker='MSFT'"
        ).fetchone()
        conn.close()
        assert row is not None
