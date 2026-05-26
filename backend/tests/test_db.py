"""Tests for app/db.py -- trade execution, P&L, validation, snapshots, watchlist."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from unittest.mock import patch

import pytest

from app.db import SCHEMA_SQL, execute_trade, take_snapshot

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_conn() -> sqlite3.Connection:
    """Return a fresh in-memory SQLite connection with the full schema and a default user."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    conn.execute(
        "INSERT INTO users_profile (id, cash_balance, created_at) "
        "VALUES ('default', 10000.0, '2024-01-01T00:00:00+00:00')"
    )
    conn.commit()
    return conn


@contextmanager
def _patched_db(conn: sqlite3.Connection):
    """Replace get_db with a version that reuses *conn* without closing it."""

    @contextmanager
    def fake_get_db():
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    with patch("app.db.get_db", fake_get_db):
        yield


def _cash(conn: sqlite3.Connection) -> float:
    return conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id='default'"
    ).fetchone()[0]


def _position(conn: sqlite3.Connection, ticker: str):
    return conn.execute(
        "SELECT quantity, avg_cost FROM positions WHERE user_id='default' AND ticker=?",
        (ticker,),
    ).fetchone()


# ---------------------------------------------------------------------------
# Trade execution -- buy
# ---------------------------------------------------------------------------


class TestBuy:
    def test_buy_creates_position(self):
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 10, 100.0)
        pos = _position(conn, "AAPL")
        assert pos is not None
        assert pos["quantity"] == 10
        assert pos["avg_cost"] == 100.0

    def test_buy_decreases_cash(self):
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 10, 100.0)
        assert _cash(conn) == pytest.approx(9000.0)

    def test_buy_records_trade_row(self):
        conn = _make_conn()
        with _patched_db(conn):
            result = execute_trade("default", "AAPL", "buy", 5, 200.0)
        trade = conn.execute("SELECT * FROM trades WHERE id=?", (result["id"],)).fetchone()
        assert trade is not None
        assert trade["side"] == "buy"
        assert trade["quantity"] == 5
        assert trade["price"] == 200.0

    def test_weighted_avg_cost_two_tranches(self):
        """Buy 10 @ $100, then 10 @ $120 -> avg_cost = (1000+1200)/20 = $110."""
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 10, 100.0)
            execute_trade("default", "AAPL", "buy", 10, 120.0)
        pos = _position(conn, "AAPL")
        assert pos["quantity"] == pytest.approx(20.0)
        assert pos["avg_cost"] == pytest.approx(110.0)

    def test_weighted_avg_cost_three_tranches(self):
        """Buy 5@$100, 5@$200, 10@$150 -> avg = (500+1000+1500)/20 = $150."""
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 5, 100.0)
            execute_trade("default", "AAPL", "buy", 5, 200.0)
            execute_trade("default", "AAPL", "buy", 10, 150.0)
        pos = _position(conn, "AAPL")
        assert pos["quantity"] == pytest.approx(20.0)
        assert pos["avg_cost"] == pytest.approx(150.0)

    def test_buy_fractional_shares(self):
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 0.5, 200.0)
        pos = _position(conn, "AAPL")
        assert pos["quantity"] == pytest.approx(0.5)
        assert _cash(conn) == pytest.approx(9900.0)


# ---------------------------------------------------------------------------
# Trade execution -- sell
# ---------------------------------------------------------------------------


class TestSell:
    def test_sell_decreases_position(self):
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 10, 100.0)
            execute_trade("default", "AAPL", "sell", 4, 110.0)
        pos = _position(conn, "AAPL")
        assert pos["quantity"] == pytest.approx(6.0)

    def test_sell_increases_cash(self):
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 10, 100.0)
            cash_after_buy = _cash(conn)
            execute_trade("default", "AAPL", "sell", 5, 120.0)
        assert _cash(conn) == pytest.approx(cash_after_buy + 600.0)

    def test_full_sell_removes_position_row(self):
        """Selling entire position must delete the row from positions."""
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 10, 100.0)
            execute_trade("default", "AAPL", "sell", 10, 100.0)
        assert _position(conn, "AAPL") is None

    def test_sell_records_trade_row(self):
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 10, 100.0)
            result = execute_trade("default", "AAPL", "sell", 3, 110.0)
        trade = conn.execute("SELECT * FROM trades WHERE id=?", (result["id"],)).fetchone()
        assert trade["side"] == "sell"
        assert trade["quantity"] == 3


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------


class TestValidation:
    def test_buy_insufficient_cash_raises(self):
        conn = _make_conn()
        with _patched_db(conn):
            with pytest.raises(ValueError, match="Insufficient cash"):
                execute_trade("default", "AAPL", "buy", 1000, 100.0)  # $100k > $10k

    def test_sell_more_than_owned_raises(self):
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 5, 100.0)
            with pytest.raises(ValueError, match="Insufficient shares"):
                execute_trade("default", "AAPL", "sell", 10, 100.0)

    def test_sell_ticker_not_in_portfolio_raises(self):
        conn = _make_conn()
        with _patched_db(conn):
            with pytest.raises(ValueError, match="Insufficient shares"):
                execute_trade("default", "AAPL", "sell", 1, 100.0)

    def test_invalid_side_raises(self):
        conn = _make_conn()
        with _patched_db(conn):
            with pytest.raises(ValueError, match="Invalid side"):
                execute_trade("default", "AAPL", "hold", 1, 100.0)

    def test_buy_exactly_at_cash_limit_succeeds(self):
        """Spending exactly all remaining cash should succeed."""
        conn = _make_conn()
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 100, 100.0)  # exactly $10,000
        assert _cash(conn) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Portfolio snapshots
# ---------------------------------------------------------------------------


class _FakePriceCache:
    def __init__(self, prices: dict[str, float]):
        self._prices = prices

    def get_price(self, ticker: str) -> float | None:
        return self._prices.get(ticker)


class TestTakeSnapshot:
    def test_snapshot_cash_only(self):
        """No positions -> total_value equals cash_balance."""
        conn = _make_conn()
        cache = _FakePriceCache({})
        with _patched_db(conn):
            take_snapshot("default", cache)
        row = conn.execute(
            "SELECT total_value FROM portfolio_snapshots WHERE user_id='default'"
        ).fetchone()
        assert row["total_value"] == pytest.approx(10000.0)

    def test_snapshot_with_positions(self):
        """total_value = cash + sum(qty * price)."""
        conn = _make_conn()
        cache = _FakePriceCache({"AAPL": 150.0, "TSLA": 200.0})
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 10, 100.0)  # spend $1000
            execute_trade("default", "TSLA", "buy", 5, 200.0)   # spend $1000
            take_snapshot("default", cache)
        # cash=8000, holdings=10*150+5*200=2500, total=10500
        row = conn.execute(
            "SELECT total_value FROM portfolio_snapshots WHERE user_id='default'"
        ).fetchone()
        assert row["total_value"] == pytest.approx(10500.0)

    def test_snapshot_unknown_ticker_price_treated_as_zero(self):
        """Missing price for a ticker contributes 0 to holdings."""
        conn = _make_conn()
        cache = _FakePriceCache({})
        with _patched_db(conn):
            execute_trade("default", "AAPL", "buy", 10, 100.0)
            take_snapshot("default", cache)
        # cash=9000, AAPL price unknown -> 0; total=9000
        row = conn.execute(
            "SELECT total_value FROM portfolio_snapshots WHERE user_id='default'"
        ).fetchone()
        assert row["total_value"] == pytest.approx(9000.0)

    def test_snapshot_inserts_new_row_each_call(self):
        conn = _make_conn()
        cache = _FakePriceCache({})
        with _patched_db(conn):
            take_snapshot("default", cache)
            take_snapshot("default", cache)
        count = conn.execute(
            "SELECT COUNT(*) FROM portfolio_snapshots WHERE user_id='default'"
        ).fetchone()[0]
        assert count == 2


# ---------------------------------------------------------------------------
# Watchlist uniqueness
# ---------------------------------------------------------------------------


class TestWatchlist:
    def test_duplicate_ticker_rejected_by_constraint(self):
        """UNIQUE(user_id, ticker) must reject a plain INSERT duplicate."""
        conn = _make_conn()
        now = "2024-01-01T00:00:00+00:00"
        conn.execute(
            "INSERT INTO watchlist (user_id, ticker, added_at) VALUES ('default', 'AAPL', ?)",
            (now,),
        )
        conn.commit()
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO watchlist (user_id, ticker, added_at) VALUES ('default', 'AAPL', ?)",
                (now,),
            )
            conn.commit()

    def test_insert_or_ignore_is_idempotent(self):
        """INSERT OR IGNORE on a duplicate ticker must leave exactly one row."""
        conn = _make_conn()
        now = "2024-01-01T00:00:00+00:00"
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at) "
            "VALUES ('default', 'AAPL', ?)",
            (now,),
        )
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at) "
            "VALUES ('default', 'AAPL', ?)",
            (now,),
        )
        conn.commit()
        count = conn.execute(
            "SELECT COUNT(*) FROM watchlist WHERE user_id='default' AND ticker='AAPL'"
        ).fetchone()[0]
        assert count == 1

    def test_different_tickers_both_inserted(self):
        conn = _make_conn()
        now = "2024-01-01T00:00:00+00:00"
        conn.execute(
            "INSERT INTO watchlist (user_id, ticker, added_at) VALUES ('default', 'AAPL', ?)",
            (now,),
        )
        conn.execute(
            "INSERT INTO watchlist (user_id, ticker, added_at) VALUES ('default', 'TSLA', ?)",
            (now,),
        )
        conn.commit()
        count = conn.execute(
            "SELECT COUNT(*) FROM watchlist WHERE user_id='default'"
        ).fetchone()[0]
        assert count == 2
