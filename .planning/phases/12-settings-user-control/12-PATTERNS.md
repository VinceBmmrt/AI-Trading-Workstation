# Phase 12 Pattern Map

## backend/app/routes/settings.py
**Analog:** ackend/app/routes/alerts.py

```python
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_db

USER_ID = "default"

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdateBody(BaseModel):
    theme: str
    starting_capital: float


@router.get("")
def get_settings():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, user_id, theme, starting_capital, updated_at "
            "FROM user_settings WHERE user_id=?",
            (USER_ID,),
        ).fetchall()
    if not rows:
        return {"theme": "dark", "starting_capital": 10000.0}
    return {
        "theme": rows[0]["theme"],
        "starting_capital": rows[0]["starting_capital"],
    }


@router.put("")
def update_settings(body: SettingsUpdateBody):
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM user_settings WHERE user_id=?", (USER_ID,)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE user_settings SET theme=?, starting_capital=?, updated_at=datetime('now') "
                "WHERE user_id=?",
                (body.theme, body.starting_capital, USER_ID),
            )
        else:
            conn.execute(
                "INSERT INTO user_settings (user_id, theme, starting_capital, updated_at) "
                "VALUES (?, ?, ?, datetime('now'))",
                (USER_ID, body.theme, body.starting_capital),
            )
    return {"success": True, "settings": {"theme": body.theme, "starting_capital": body.starting_capital}}
```

**Key patterns extracted:**
- Router prefix /api/settings with tags
- Pydantic BaseModel for request validation
- USER_ID = "default" constant
- get_db() context manager usage
- GET endpoint returning dict/list
- PUT/UPDATE endpoint with INSERT OR IGNORE for initialization pattern
- Success response with nested data

---

## backend/tests/test_settings.py
**Analog:** ackend/tests/test_alerts.py

```python
"""Unit tests for user settings — DB CRUD and REST endpoints."""

from __future__ import annotations

import os
import sqlite3
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db import get_db, init_db
from app.market.cache import PriceCache
from app.routes import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_app(db_path, price_cache: PriceCache) -> TestClient:
    app = FastAPI()
    app.include_router(settings.router)
    app.state.price_cache = price_cache
    return TestClient(app)


def _insert_settings(db_path, theme: str = "dark", starting_capital: float = 10000.0) -> None:
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT OR IGNORE INTO user_settings (user_id, theme, starting_capital, updated_at) "
        "VALUES ('default', ?, ?, datetime('now'))",
        (theme, starting_capital),
    )
    conn.commit()
    conn.close()


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
    return cache


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestGetSettings:
    def test_get_settings_default(self, db_path, price_cache):
        """GET /api/settings returns default settings when none exist."""
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["theme"] == "dark"
        assert data["starting_capital"] == 10000.0

    def test_get_settings_returns_stored(self, db_path, price_cache):
        """GET /api/settings returns stored user settings."""
        _insert_settings(db_path, theme="light", starting_capital=50000.0)
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["theme"] == "light"
        assert data["starting_capital"] == 50000.0


class TestUpdateSettings:
    def test_update_settings_creates(self, db_path, price_cache):
        """PUT /api/settings creates new settings if none exist."""
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.put(
                "/api/settings",
                json={"theme": "light", "starting_capital": 25000.0},
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert resp.json()["settings"]["theme"] == "light"

    def test_update_settings_updates_existing(self, db_path, price_cache):
        """PUT /api/settings updates existing settings."""
        _insert_settings(db_path, theme="dark", starting_capital=10000.0)
        client = _make_app(db_path, price_cache)
        with patch.dict(os.environ, {"DB_PATH": str(db_path)}):
            resp = client.put(
                "/api/settings",
                json={"theme": "light", "starting_capital": 50000.0},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["settings"]["theme"] == "light"
        assert data["settings"]["starting_capital"] == 50000.0
```

**Key patterns extracted:**
- @pytest.fixture for db_path with 	mp_path and patch.dict(os.environ, {"DB_PATH": ...})
- _make_app(db_path, price_cache) factory creating FastAPI app with router
- TestClient(app) usage
- Helper function _insert_settings() for test data setup
- Test classes with descriptive method names and docstrings
- patch.dict(os.environ, ...) for DB_PATH injection in each test
- Status code assertions and JSON response validation

---

## frontend/components/SettingsPanel.tsx
**Analog:** rontend/components/AlertPopover.tsx

```tsx
"use client";

import { useState } from "react";

interface Props {
  theme: string;
  startingCapital: number;
  onClose: () => void;
  onSubmit: (theme: string, startingCapital: number) => Promise<void>;
}

export default function SettingsPanel({ theme, startingCapital, onClose, onSubmit }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<string>(theme);
  const [capitalInput, setCapitalInput] = useState(startingCapital.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const parsed = parseFloat(capitalInput);
    if (!capitalInput || parsed <= 0 || isNaN(parsed)) {
      setError("Enter a valid positive amount");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit(selectedTheme, parsed);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded p-4 w-72 shadow-xl font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] text-text-dim uppercase tracking-widest mb-3">
          Settings
        </div>

        <div className="mb-4">
          <label className="text-[10px] text-text-dim uppercase tracking-widest block mb-2">
            Theme
          </label>
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTheme(t)}
                className={lex-1 text-[10px] px-2 py-1.5 rounded uppercase font-mono border transition-colors \}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="text-[10px] text-text-dim uppercase tracking-widest block mb-2">
            Starting Capital
          </label>
          <input
            type="number"
            step="100"
            min="100"
            value={capitalInput}
            onChange={(e) => setCapitalInput(e.target.value)}
            placeholder="$"
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs font-mono text-text"
          />
        </div>

        {error && <p className="text-down text-[10px] mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 text-[10px] px-2 py-1.5 rounded bg-blue/20 text-blue border border-blue/40 font-mono uppercase hover:bg-blue/30 disabled:opacity-50"
          >
            {loading ? "..." : "Save"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-[10px] px-2 py-1.5 rounded bg-bg text-text-dim border border-border font-mono uppercase hover:bg-surface-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Key patterns extracted:**
- "use client" directive at top
- Fixed overlay with ixed inset-0 z-40 for background
- Inner panel with g-surface border border-border rounded p-4
- onClick={e => e.stopPropagation()} to prevent close when clicking panel
- Form inputs with placeholder and number validation
- Button group with state-driven styling
- Error display with conditional rendering
- Loading state on submit button
- Destructured props with TypeScript interface

---

## frontend/hooks/useTheme.ts
**Analog:** rontend/hooks/useAlerts.ts

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchSettings, updateSettings as apiUpdateSettings } from "@/lib/api";
import type { Settings } from "@/lib/types";

export function useTheme() {
  const [settings, setSettings] = useState<Settings>({
    theme: "dark",
    starting_capital: 10000,
  });

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSettings();
      setSettings(data);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSettings = useCallback(
    async (theme: string, startingCapital: number) => {
      const updated = await apiUpdateSettings(theme, startingCapital);
      setSettings(updated.settings);
    },
    []
  );

  return { settings, updateSettings, refresh };
}
```

**Key patterns extracted:**
- "use client" directive at top
- Named export export function useTheme()
- useState with initial state object
- useCallback for efresh that calls API
- useEffect that calls refresh on component mount
- Try/catch with silent ignore on fetch errors
- Second useCallback for mutation operation
- Return object with state and methods
- Async/await pattern for API calls
- Optional dependencies array for useCallback

---

## backend/app/db.py changes
**Pattern:** existing SCHEMA_SQL and init_db() seed

Current SCHEMA_SQL includes:
```python
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
```

**For Phase 12, add table to SCHEMA_SQL:**
```python
CREATE TABLE IF NOT EXISTS user_settings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          TEXT NOT NULL DEFAULT 'default',
    theme            TEXT NOT NULL DEFAULT 'dark',
    starting_capital REAL NOT NULL DEFAULT 10000.0,
    updated_at       TEXT NOT NULL,
    UNIQUE(user_id)
);
```

**And seed pattern in init_db():**
```python
# After watchlist seeding, add:
conn.execute(
    "INSERT OR IGNORE INTO user_settings (user_id, theme, starting_capital, updated_at) "
    "VALUES ('default', 'dark', 10000.0, ?)",
    (now,),
)
```

---

## backend/app/routes/portfolio.py changes
**Pattern:** STARTING_CAPITAL constant and get_analytics usage

**Current at line 129:**
```python
STARTING_CAPITAL = 10_000.0
```

**Used in get_analytics() function (lines 132-207):**
```python
@router.get("/analytics")
def get_analytics(request: Request):
    price_cache = request.app.state.price_cache
    with get_db() as conn:
        profile = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id=?", (USER_ID,)
        ).fetchone()
        trades = conn.execute(
            "SELECT ticker, side, quantity, price FROM trades WHERE user_id=?",
            (USER_ID,),
        ).fetchall()
        positions = conn.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id=?",
            (USER_ID,),
        ).fetchall()

    cash = profile["cash_balance"]

    total_invested = sum(r["quantity"] * r["price"] for r in trades if r["side"] == "buy")
    total_received = sum(r["quantity"] * r["price"] for r in trades if r["side"] == "sell")
    realized_pnl = round(cash - STARTING_CAPITAL - (total_invested - total_received), 2)
    
    # ... more calculations using STARTING_CAPITAL at lines 152, 174
    total_return_pct = round((total_value - STARTING_CAPITAL) / STARTING_CAPITAL * 100, 2)
```

**For Phase 12:**
- Replace hardcoded STARTING_CAPITAL constant with dynamic fetch from settings
- Query user_settings table for starting_capital value
- Fall back to 10000.0 if not set
- Pass starting_capital through analytics calculations

---

## frontend/components/Header.tsx changes
**Pattern:** current props and STARTING_CAPITAL reference

**Current Header signature (lines 35-36):**
```tsx
interface Props {
  portfolio: Portfolio | null;
  status: ConnectionStatus;
}

export default function Header({ portfolio, status }: Props) {
```

**STARTING_CAPITAL hardcoded at line 29:**
```tsx
const STARTING_CAPITAL = 10_000;
```

**Used for P&L calculations (lines 56-57):**
```tsx
const netPnL      = portfolio ? totalValue - STARTING_CAPITAL : null;
const netPnLPct   = netPnL !== null ? (netPnL / STARTING_CAPITAL) * 100 : null;
```

**For Phase 12:**
- Add startingCapital: number to Props interface
- Remove hardcoded STARTING_CAPITAL constant
- Replace all STARTING_CAPITAL references with startingCapital prop
- Example: const netPnL = portfolio ? totalValue - startingCapital : null;
- Add gear icon button in RIGHT section before status indicator
- Position: after time display, before status border (line 150)

---

## frontend/app/globals.css changes
**Pattern:** @theme block

**Current @theme block (lines 3-23):**
```css
@theme {
  --color-bg: #0d1117;
  --color-surface: #161b22;
  --color-surface-2: #1c2128;
  --color-surface-3: #22272e;
  --color-border: #30363d;
  --color-border-subtle: #21262d;
  --color-muted: #8b949e;
  --color-text: #e6edf3;
  --color-text-dim: #7d8590;
  --color-accent: #ecad0a;
  --color-blue: #209dd7;
  --color-purple: #753991;
  --color-up: #3fb950;
  --color-down: #f85149;
  --color-up-dim: #1a3d22;
  --color-down-dim: #3d1a1a;

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-ibm-mono);
}
```

**For Phase 12:**
- Keep all existing color definitions as-is (no new CSS variables needed)
- Add optional light theme variant if theme toggle is implemented
- All theme UI colors will use existing palette via Tailwind classes
- No changes to globals.css required (CSS variable switching handled in page/component logic)

---

## frontend/app/page.tsx changes
**Pattern:** existing useState, useEffect, and component rendering

**Current useState declarations (lines 46-50):**
```tsx
const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
const [selectedTicker, setSelectedTicker] = useState("AAPL");
const [chatOpen, setChatOpen] = useState(true);
const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("positions");
const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chart");
```

**Hook usage (lines 42-44):**
```tsx
const { alerts, toasts, handleAlertFired, dismissToast, createAlert } = useAlerts();
const market = useMarketData({ onAlertFired: handleAlertFired });
const { portfolio, history, trades, analytics, refresh: refreshPortfolio } = usePortfolio();
```

**useEffect examples (lines 53-65):**
```tsx
useEffect(() => {
  const BREAKPOINT = 1100;
  function check() { if (window.innerWidth < BREAKPOINT) setChatOpen(false); }
  check();
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);

useEffect(() => {
  fetchWatchlist()
    .then((items) => { if (items.length > 0) setTickers(items.map((i) => i.ticker)); })
    .catch(() => {});
}, []);
```

**Header rendering (line 156):**
```tsx
<Header portfolio={portfolio} status={market.status} />
```

**For Phase 12:**
- Add new hook: const { settings, updateSettings } = useTheme();
- Add useState for settings panel visibility: const [showSettings, setShowSettings] = useState(false);
- Pass startingCapital={settings.starting_capital} to Header component
- Create function handleSaveSettings(theme, capital) that calls updateSettings() and closes panel
- Add SettingsPanel component conditionally below ToastContainer
- No changes to existing useEffect hooks or other state management needed

---

## PATTERN MAPPING COMPLETE
