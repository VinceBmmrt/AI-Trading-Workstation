"""SQLite database setup and shared data operations."""

from __future__ import annotations

import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_TICKERS = [
    # Tech
    "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "NFLX",
    "AMD", "INTC", "CRM", "ORCL", "SNOW", "PLTR",
    # Finance
    "JPM", "V", "GS", "MS", "BAC", "BRK.B",
    # Healthcare
    "JNJ", "UNH", "PFE", "LLY",
    # Energy
    "XOM", "CVX", "OXY",
    # Consumer
    "WMT", "COST", "MCD",
    # ETFs
    "SPY", "QQQ", "IWM",
]

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users_profile (
    id TEXT PRIMARY KEY,
    cash_balance REAL NOT NULL DEFAULT 10000.0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(user_id, ticker)
);
CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    quantity REAL NOT NULL,
    avg_cost REAL NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, ticker)
);
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    executed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    total_value REAL NOT NULL,
    recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    actions TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS price_alerts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT NOT NULL DEFAULT 'default',
    ticker       TEXT NOT NULL,
    target_price REAL NOT NULL,
    direction    TEXT NOT NULL CHECK(direction IN ('above','below')),
    active       INTEGER NOT NULL DEFAULT 1,
    triggered_at TEXT,
    created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    starting_capital REAL NOT NULL DEFAULT 10000.0
);
"""


def _db_path() -> Path:
    env_path = os.environ.get("DB_PATH", "").strip()
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parent.parent.parent / "db" / "AI Trading Workstation.db"


@contextmanager
def get_db():
    """Yield a sqlite3.Connection, commit on success, rollback on error."""
    path = _db_path()
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create all tables and seed default data. Idempotent."""
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA_SQL)
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
        ("default", 10000.0, now),
    )
    count = conn.execute(
        "SELECT COUNT(*) FROM watchlist WHERE user_id = 'default'"
    ).fetchone()[0]
    if count == 0:
        conn.executemany(
            "INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at) VALUES ('default', ?, ?)",
            [(t, now) for t in DEFAULT_TICKERS],
        )
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (id, starting_capital) VALUES ('default', 10000.0)"
    )
    conn.commit()
    conn.close()


def execute_trade(user_id: str, ticker: str, side: str, quantity: float, price: float) -> dict:
    """Execute a market order. Updates cash, positions, and inserts trade record.

    Raises ValueError on insufficient funds or shares.
    """
    now = datetime.now(timezone.utc).isoformat()
    trade_id = str(uuid.uuid4())
    cost = round(quantity * price, 2)

    with get_db() as conn:
        profile = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (user_id,)
        ).fetchone()
        if not profile:
            raise ValueError("User not found")
        cash = profile["cash_balance"]

        if side == "buy":
            if cash < cost:
                raise ValueError(f"Insufficient cash: need ${cost:.2f}, have ${cash:.2f}")
            pos = conn.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
                (user_id, ticker),
            ).fetchone()
            if pos:
                new_qty = pos["quantity"] + quantity
                new_avg = round((pos["quantity"] * pos["avg_cost"] + cost) / new_qty, 4)
                conn.execute(
                    "UPDATE positions SET quantity=?, avg_cost=?, updated_at=? "
                    "WHERE user_id=? AND ticker=?",
                    (new_qty, new_avg, now, user_id, ticker),
                )
            else:
                conn.execute(
                    "INSERT INTO positions (user_id, ticker, quantity, avg_cost, updated_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (user_id, ticker, quantity, price, now),
                )
            conn.execute(
                "UPDATE users_profile SET cash_balance=? WHERE id=?",
                (round(cash - cost, 2), user_id),
            )

        elif side == "sell":
            pos = conn.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id=? AND ticker=?",
                (user_id, ticker),
            ).fetchone()
            owned = pos["quantity"] if pos else 0
            if not pos or owned < quantity:
                raise ValueError(f"Insufficient shares: need {quantity}, have {owned}")
            new_qty = round(owned - quantity, 8)
            if new_qty <= 1e-8:
                conn.execute(
                    "DELETE FROM positions WHERE user_id=? AND ticker=?", (user_id, ticker)
                )
            else:
                conn.execute(
                    "UPDATE positions SET quantity=?, updated_at=? WHERE user_id=? AND ticker=?",
                    (new_qty, now, user_id, ticker),
                )
            conn.execute(
                "UPDATE users_profile SET cash_balance=? WHERE id=?",
                (round(cash + cost, 2), user_id),
            )
        else:
            raise ValueError(f"Invalid side: {side}")

        conn.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (trade_id, user_id, ticker, side, quantity, price, now),
        )

    return {
        "id": trade_id,
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "price": price,
        "executed_at": now,
    }


def take_snapshot(user_id: str, price_cache) -> None:
    """Record current portfolio total value as a snapshot."""
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id=?", (user_id,)
        ).fetchone()
        if not row:
            return
        cash = row["cash_balance"]
        positions = conn.execute(
            "SELECT ticker, quantity FROM positions WHERE user_id=?", (user_id,)
        ).fetchall()
        holdings = sum(
            r["quantity"] * (price_cache.get_price(r["ticker"]) or 0) for r in positions
        )
        total = round(cash + holdings, 2)
        conn.execute(
            "INSERT INTO portfolio_snapshots (user_id, total_value, recorded_at) VALUES (?,?,?)",
            (user_id, total, now),
        )
