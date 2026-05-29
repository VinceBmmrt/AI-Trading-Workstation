# Phase 12 Research: Settings & User Control

## 1. Portfolio Reset

### DB Scope

Tables to wipe on reset (user_id = 'default'):
- `DELETE FROM trades WHERE user_id = 'default'`
- `DELETE FROM positions WHERE user_id = 'default'`
- `DELETE FROM portfolio_snapshots WHERE user_id = 'default'`
- `chat_messages` — **do NOT wipe**. Chat history is independent of portfolio state. Wiping it would confuse users who asked about their now-reset portfolio.
- `price_alerts` — **do NOT wipe**. Alerts are independent; user may want to keep them.

After deleting, restore cash:
```sql
UPDATE users_profile SET cash_balance = ? WHERE id = 'default'
```
where `?` is the `starting_capital` from settings (see Section 2).

Transaction pattern from `db.py`: use `get_db()` context manager — single `with get_db() as conn:` block executes all DELETEs and the UPDATE, then the context manager commits atomically. No need for `conn.executescript()` since these are parameterized statements.

```python
with get_db() as conn:
    starting = conn.execute(
        "SELECT starting_capital FROM app_settings WHERE id = 'default'"
    ).fetchone()["starting_capital"]
    conn.execute("DELETE FROM trades WHERE user_id = 'default'")
    conn.execute("DELETE FROM positions WHERE user_id = 'default'")
    conn.execute("DELETE FROM portfolio_snapshots WHERE user_id = 'default'")
    conn.execute(
        "UPDATE users_profile SET cash_balance = ? WHERE id = 'default'",
        (starting,)
    )
```

### API Design

**Endpoint:** `POST /api/portfolio/reset`

No request body needed (single-user, user_id hardcoded as "default").

Response:
```json
{
  "success": true,
  "cash_balance": 10000.0
}
```

On error (DB failure), return HTTP 500 with `{"detail": "Reset failed: ..."}`.

Lives in `backend/app/routes/portfolio.py` as a new `@router.post("/reset")` handler. No new route file needed.

### Frontend Design

The reset button lives in the settings panel (see Section 5). Confirm flow:
- User clicks "Reset Portfolio" button → inline confirm state within the settings panel shows "Are you sure? This will wipe all trades and positions." with a "Confirm Reset" button and "Cancel" button.
- On confirm: call `POST /api/portfolio/reset`, then call `refreshPortfolio()` (passed down or triggered via a callback).
- After reset, close the settings panel.

Do NOT use `window.confirm()` — it's blocking and ugly. Use inline state instead, matching the `AlertPopover` pattern.

---

## 2. Starting Capital / Settings

### DB Design Decision

**Use a separate `app_settings` table (key-value or single-row).** Rationale:

1. SQLite `ALTER TABLE` has severe limitations: it cannot add a NOT NULL column without a DEFAULT, and `conn.executescript(SCHEMA_SQL)` uses `CREATE TABLE IF NOT EXISTS` — once the table exists, schema changes are silently ignored. Adding a `starting_capital` column to `users_profile` on an existing DB would require an `ALTER TABLE` migration step.

2. A separate `app_settings` table with `CREATE TABLE IF NOT EXISTS` in `SCHEMA_SQL` handles the new-DB and existing-DB cases cleanly: on a fresh DB it creates the table; on an existing DB the IF NOT EXISTS is a no-op and the seed INSERT OR IGNORE adds the default row.

3. A single-row settings table (id = 'default') is simple and extensible — future settings (e.g., notification preferences, refresh rate) slot in as additional columns without further migrations.

### Schema Change

Add to `SCHEMA_SQL` in `backend/app/db.py` (append after the `price_alerts` table):

```sql
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    starting_capital REAL NOT NULL DEFAULT 10000.0
);
```

Add to `init_db()` after the existing seed inserts:

```python
conn.execute(
    "INSERT OR IGNORE INTO app_settings (id, starting_capital) VALUES ('default', 10000.0)"
)
```

This is fully idempotent — safe to run against an existing DB with or without the new table.

### API Design

Two endpoints, added to a new route file `backend/app/routes/settings.py`:

```
GET  /api/settings   → { "starting_capital": 10000.0 }
PUT  /api/settings   → body: { "starting_capital": 25000.0 }
                       → { "starting_capital": 25000.0 }
```

Validation on PUT: `starting_capital` must be a positive number. Return HTTP 422 if invalid.

Register the router in `main.py` as `app.include_router(settings.router)`.

**Important:** `STARTING_CAPITAL = 10_000.0` is currently hardcoded in two places:
- `backend/app/routes/portfolio.py` line 129 (used in `get_analytics`)
- `frontend/components/Header.tsx` line 29 (used for net P&L display)

After Phase 12, the backend `get_analytics` endpoint should read `starting_capital` from the DB instead of the hardcoded constant. The frontend Header should receive `starting_capital` from the `GET /api/settings` response (or the portfolio endpoint could include it).

Simplest approach: add `starting_capital` to the `GET /api/portfolio` response so the Header always has the correct baseline without an extra API call.

---

## 3. Layout Persistence

### State Inventory

All state that should persist (defined in `frontend/app/page.tsx`):

| State variable | Type | Where defined | Key name |
|---|---|---|---|
| `selectedTicker` | `string` | `page.tsx` line 47 | `fa_selected_ticker` |
| `chatOpen` | `boolean` | `page.tsx` line 48 | `fa_chat_open` |
| `portfolioTab` | `PortfolioTab` | `page.tsx` line 49 | `fa_portfolio_tab` |
| `mobilePanel` | `MobilePanel` | `page.tsx` line 50 | `fa_mobile_panel` |

`tickers` (watchlist) is fetched from the backend on mount — no need to persist in localStorage.

The chat panel collapse state is reset by the breakpoint `useEffect` (line 53–59) when width < 1100px. This is intentional behavior — on narrow viewports it forces collapse. localStorage should store the user's preference but the breakpoint effect can still override it on narrow screens.

### localStorage Pattern

**Initialization (read on mount):**

```typescript
// In page.tsx, replace useState defaults:
const [selectedTicker, setSelectedTicker] = useState(() => {
  if (typeof window === "undefined") return "AAPL";
  return localStorage.getItem("fa_selected_ticker") ?? "AAPL";
});
```

The `typeof window === "undefined"` guard is **required** for Next.js static export. Even with `"use client"`, the component may render server-side during build. Without the guard, `localStorage is not defined` will throw at build time.

**Persistence (write on change):**

```typescript
useEffect(() => { localStorage.setItem("fa_selected_ticker", selectedTicker); }, [selectedTicker]);
useEffect(() => { localStorage.setItem("fa_chat_open", JSON.stringify(chatOpen)); }, [chatOpen]);
useEffect(() => { localStorage.setItem("fa_portfolio_tab", portfolioTab); }, [portfolioTab]);
useEffect(() => { localStorage.setItem("fa_mobile_panel", mobilePanel); }, [mobilePanel]);
```

Each state variable gets its own `useEffect` — simple and follows the existing pattern in `useMarketData`.

**Reading back booleans:** `localStorage.getItem("fa_chat_open") === "true"` or `JSON.parse(...)` — use the string comparison form to avoid JSON.parse throwing on malformed values.

**Key prefix `fa_`** (Finance Ally) avoids collisions with any other apps on the same origin.

---

## 4. Theme Toggle

### CSS Architecture

`frontend/app/globals.css` uses Tailwind v4's `@theme` block to define CSS custom properties. The current tokens are all dark-theme values defined globally (no `.dark` class scoping):

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
  --color-accent: #ecad0a;     /* yellow — unchanged in light mode */
  --color-blue: #209dd7;       /* unchanged */
  --color-purple: #753991;     /* unchanged */
  --color-up: #3fb950;         /* unchanged */
  --color-down: #f85149;       /* unchanged */
  --color-up-dim: #1a3d22;
  --color-down-dim: #3d1a1a;
}
```

There is **no** `tailwind.config.ts` — Tailwind v4 uses `@theme` in CSS, not a config file. The `frontend/next.config.ts` confirms `output: "export"` and `reactCompiler: true`.

`frontend/app/layout.tsx` applies the base class on `<html>`:
```tsx
<html lang="en" className={`${geistSans.variable} ${ibmMono.variable} h-full`}>
```

### Implementation Approach

**Method:** Add a `.light` class to `<html>` and override CSS variables in `globals.css`:

```css
html.light {
  --color-bg: #f6f8fa;
  --color-surface: #ffffff;
  --color-surface-2: #f0f2f5;
  --color-surface-3: #e8eaed;
  --color-border: #d0d7de;
  --color-border-subtle: #e4e8ec;
  --color-muted: #57606a;
  --color-text: #1f2328;
  --color-text-dim: #57606a;
  --color-up-dim: #d4edda;
  --color-down-dim: #fde8e8;
}

html.light body {
  background: #f6f8fa;
  color: #1f2328;
}
```

Accent, blue, purple, up, down colors stay the same — they work on both dark and light backgrounds.

**Toggle mechanism:**

1. Store theme in localStorage key `fa_theme` (`"dark"` | `"light"`), defaulting to `"dark"`.
2. Apply class on `<html>` element:
   ```typescript
   document.documentElement.classList.toggle("light", theme === "light");
   ```
3. A `useTheme` hook (or inline in `page.tsx`) manages this state.
4. The toggle button lives in the settings panel (or as a small sun/moon icon in the Header).

**Hydration gotcha:** The theme class must be applied before first paint to avoid a flash of wrong theme. Since this is a static export with `"use client"`, the cleanest approach is to read `localStorage` in the `useState` initializer (with the `typeof window` guard) and apply the class immediately in a `useEffect` with no deps delay issue — but for a trading terminal this flash is acceptable given the complexity of SSR workarounds. Alternatively, add an inline `<script>` to `layout.tsx` that reads localStorage and sets the class before hydration.

The flash is minor for a desktop trading app. The simpler `useEffect` approach is recommended.

---

## 5. Settings Panel UI

### Component Design

**New component:** `frontend/components/SettingsPanel.tsx`

- Opened via a gear icon (⚙) button in the `Header` component (right side, next to the clock/status).
- Rendered as a **modal overlay** — `fixed inset-0 z-50` backdrop + centered panel, matching the `AlertPopover` approach.
- The `Header` receives an `onOpenSettings` prop or the settings state is lifted to `page.tsx` with a `settingsOpen` boolean.

Recommended: keep `settingsOpen` state in `page.tsx` (alongside other global state), pass `onOpenSettings` to `Header`, and render `<SettingsPanel>` conditionally in `page.tsx`.

**Panel contents:**

1. **Theme Toggle** — "Dark / Light" toggle switch or two-button selector.
2. **Starting Capital** — numeric input showing current value, with a Save button. Validates > 0.
3. **Reset Portfolio** — danger zone section at the bottom with red styling. Two-step confirm (see below).

### Confirm Dialog

Use inline two-step confirm state within `SettingsPanel`:

```typescript
const [confirmReset, setConfirmReset] = useState(false);
```

- Default: "Reset Portfolio" button with warning text.
- After click: shows "Confirm Reset" (red) + "Cancel" buttons.
- On confirm: calls `POST /api/portfolio/reset`, then calls `onResetComplete()` callback, then `setConfirmReset(false)`.

This matches the pattern established in `AlertPopover` (inline state, no external dialog component).

---

## 6. Wave Structure Recommendation

**Wave 1 — Backend (can run in parallel):**
- Task A: `app_settings` table in `SCHEMA_SQL` + `init_db()` seed
- Task B: `backend/app/routes/settings.py` — `GET /api/settings`, `PUT /api/settings`
- Task C: `POST /api/portfolio/reset` in `portfolio.py`
- Task D: Fix `STARTING_CAPITAL` hardcoding in `get_analytics` — read from DB
- Task E: Backend tests for all new endpoints

**Wave 2 — Frontend (depends on Wave 1 backend being available):**
- Task F: `frontend/lib/api.ts` — add `fetchSettings`, `updateSettings`, `resetPortfolio`
- Task G: `frontend/lib/types.ts` — add `AppSettings` type
- Task H: `frontend/app/globals.css` — add `.light` class overrides
- Task I: `frontend/hooks/useTheme.ts` — theme state + localStorage + DOM class toggle
- Task J: `frontend/components/SettingsPanel.tsx` — full settings modal
- Task K: `frontend/app/page.tsx` — localStorage persistence for 4 state vars + `settingsOpen` state + render `SettingsPanel`
- Task L: `frontend/components/Header.tsx` — gear icon button + `onOpenSettings` prop + update `STARTING_CAPITAL` to accept prop

Wave 2 tasks F, G, H, I are independent of each other. Tasks J, K, L depend on F, G, H, I.

---

## 7. Files to Modify

### New files
- `backend/app/routes/settings.py` — GET/PUT /api/settings
- `frontend/components/SettingsPanel.tsx` — settings modal
- `frontend/hooks/useTheme.ts` — theme management hook
- `backend/tests/test_settings.py` — unit tests for new endpoints

### Modified files
- `backend/app/db.py` — add `app_settings` table to `SCHEMA_SQL`, seed in `init_db()`
- `backend/app/routes/portfolio.py` — add `POST /reset` endpoint; fix `STARTING_CAPITAL` in `get_analytics` to read from DB
- `backend/app/main.py` — `app.include_router(settings.router)`
- `frontend/lib/api.ts` — add `fetchSettings`, `updateSettings`, `resetPortfolio`
- `frontend/lib/types.ts` — add `AppSettings` interface
- `frontend/app/globals.css` — add `html.light { ... }` overrides + `html.light body { ... }`
- `frontend/app/page.tsx` — localStorage persistence for 4 state vars, `settingsOpen` state, render `SettingsPanel`
- `frontend/components/Header.tsx` — gear icon button + `onOpenSettings` prop, accept `startingCapital` prop for correct P&L baseline

---

## Validation Architecture

### Unit Tests (backend pytest)

| Test ID | File | What it verifies |
|---|---|---|
| `test_settings_get_default` | `test_settings.py` | GET /api/settings returns `{"starting_capital": 10000.0}` on fresh DB |
| `test_settings_put_valid` | `test_settings.py` | PUT with `{"starting_capital": 25000.0}` returns updated value |
| `test_settings_put_invalid_zero` | `test_settings.py` | PUT with `starting_capital=0` returns HTTP 422 |
| `test_settings_put_invalid_negative` | `test_settings.py` | PUT with `starting_capital=-100` returns HTTP 422 |
| `test_settings_persists_across_get` | `test_settings.py` | PUT then GET returns the updated value |
| `test_portfolio_reset_clears_positions` | `test_settings.py` | POST /reset → positions table empty for user |
| `test_portfolio_reset_clears_trades` | `test_settings.py` | POST /reset → trades table empty for user |
| `test_portfolio_reset_clears_snapshots` | `test_settings.py` | POST /reset → portfolio_snapshots empty for user |
| `test_portfolio_reset_restores_cash` | `test_settings.py` | POST /reset → cash_balance == starting_capital |
| `test_portfolio_reset_uses_configured_capital` | `test_settings.py` | Set starting_capital=25000, then reset → cash_balance==25000 |
| `test_portfolio_reset_preserves_chat` | `test_settings.py` | POST /reset → chat_messages NOT wiped |
| `test_portfolio_reset_preserves_alerts` | `test_settings.py` | POST /reset → price_alerts NOT wiped |
| `test_analytics_uses_db_starting_capital` | `test_settings.py` | `total_return_pct` uses DB starting_capital after update |
| `test_app_settings_schema_in_schema_sql` | `test_db.py` | `app_settings` table present in schema; INSERT OR IGNORE works |

### Manual Browser Verifications

1. **Theme toggle:** Click gear icon → toggle to Light → verify all text readable, no white-on-white, no dark-on-dark. Toggle back to Dark → verify restored. Reload page → theme persists.

2. **Starting capital:** Open settings → change to $25,000 → save → header P&L baseline updates. Restart container → GET /api/settings returns 25000.

3. **Portfolio reset — basic:** Buy some shares, set a price alert, open settings → Reset → Confirm. Verify: positions table empty, cash shows $10,000 (or configured amount), P&L shows $0. Price alerts still present.

4. **Portfolio reset — uses configured capital:** Set starting_capital to $5,000, reset → cash shows $5,000.

5. **Layout persistence:** Select TSLA ticker → switch to Analytics tab → collapse chat panel → refresh page → TSLA still selected, Analytics tab active, chat still collapsed.

6. **Mobile panel persistence:** On narrow viewport, switch to Chart panel → refresh → Chart panel still active.

7. **Light theme component audit:** With light theme active, verify each component:
   - WatchlistPanel — price flash still visible
   - PriceChart — chart lines visible against light background
   - ChatPanel — message bubbles readable
   - Header — P&L colors still green/red
   - ToastContainer — toasts readable

### Sampling Strategy

- After Wave 1 (Tasks A–E complete): run `uv run --extra dev pytest tests/ -v` — all 158 existing + ~14 new tests should pass.
- After Wave 2 Tasks F–I (api.ts, types.ts, globals.css, useTheme): no automated test, but run the dev server and verify theme toggle works in isolation.
- After Wave 2 Tasks J–L complete: run full manual browser verification checklist above.
- Final gate: run `uv run --extra dev pytest tests/ -v` again to confirm no regressions from the `STARTING_CAPITAL` refactor in `portfolio.py`.

## RESEARCH COMPLETE
