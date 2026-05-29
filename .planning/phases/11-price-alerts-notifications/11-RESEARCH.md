# Phase 11 Research: Price Alerts & Notifications

## Summary

Price alerts require four connected pieces: a `price_alerts` SQLite table (same pattern as existing tables), a background task that checks alerts on each price tick, a new SSE event type (`alert_fired`) delivered on the existing `/api/stream/prices` connection, and a stateless toast component in the frontend that consumes it. The AI context injection is minimal: fired alerts are appended as a single line to `_portfolio_context()` in `chat.py`, which already builds the full system prompt block. No new dependencies are needed on either the backend or frontend — the existing patterns cover everything.

## Architecture Decision

```
[User sets alert via WatchlistPanel bell icon]
         │ POST /api/alerts
         ▼
[price_alerts table in SQLite]
         │
[_alert_check_loop() in main.py — asyncio background task]
         │ polls price_cache every 500ms (same cadence as SSE)
         │ when ticker price crosses target_price threshold
         ▼
[marks alert: triggered_at=now, active=0]
[pushes to asyncio.Queue — one per SSE connection]
         │
[SSE generator in stream.py reads queue]
         │ emits: event: alert_fired  data: {...}
         ▼
[useMarketData hook in frontend dispatches alert event]
         │ calls onAlertFired(alert) callback → passed from page.tsx
         ▼
[ToastContainer component renders toast (bottom-right)]
[useAlerts hook stores fired alerts in state]
         │
[Next user chat message]
         │ POST /api/chat
         ▼
[_portfolio_context() reads recent fired alerts from DB]
[appended as "Recent alerts fired: ..." block in system prompt]
```

## DB Schema

Add to `SCHEMA_SQL` in `backend/app/db.py`:

```sql
CREATE TABLE IF NOT EXISTS price_alerts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT NOT NULL DEFAULT 'default',
    ticker    TEXT NOT NULL,
    target_price REAL NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('above','below')),
    active    INTEGER NOT NULL DEFAULT 1,
    triggered_at TEXT,
    created_at   TEXT NOT NULL
);
```

Column notes:
- `direction`: `'above'` fires when `current_price >= target_price`; `'below'` fires when `current_price <= target_price`. This matches the intuitive "alert me when AAPL goes above $200".
- `active`: integer 0/1 (SQLite has no BOOLEAN). Rows remain in the table after firing (for AI context and audit trail). `active=0` is the terminal state.
- No `UNIQUE` constraint — a user may set multiple alerts on the same ticker at different levels.
- `triggered_at` is NULL while pending; set to ISO timestamp when it fires.
- Use `INTEGER PRIMARY KEY AUTOINCREMENT` to match the pattern of `positions`, `watchlist`, `portfolio_snapshots`.

## Backend Implementation

### Where alert checking goes

The cleanest location is a **new background task `_alert_check_loop()`** launched in the `lifespan()` function in `main.py`, alongside the existing `snapshot_task` and `monitor_task`. It should NOT go inside the SSE generator (`stream.py`) because:
1. Multiple SSE clients would each run their own check loop, causing duplicate firings.
2. The SSE generator has no DB write access by design (it only reads the price cache).
3. A separate task mirrors the existing `_proactive_monitor_loop` pattern exactly.

The task runs on a 0.5s loop (matching SSE cadence):

```python
async def _alert_check_loop(price_cache: PriceCache, alert_queue: asyncio.Queue) -> None:
    """Check active price alerts every 500ms and push fired ones to the SSE queue."""
    while True:
        await asyncio.sleep(0.5)
        try:
            with get_db() as conn:
                rows = conn.execute(
                    "SELECT id, ticker, target_price, direction FROM price_alerts "
                    "WHERE user_id='default' AND active=1"
                ).fetchall()
            for row in rows:
                current = price_cache.get_price(row["ticker"])
                if current is None:
                    continue
                fired = (
                    row["direction"] == "above" and current >= row["target_price"]
                    or row["direction"] == "below" and current <= row["target_price"]
                )
                if not fired:
                    continue
                now = datetime.now(timezone.utc).isoformat()
                with get_db() as conn:
                    conn.execute(
                        "UPDATE price_alerts SET active=0, triggered_at=? WHERE id=?",
                        (now, row["id"]),
                    )
                await alert_queue.put({
                    "id": row["id"],
                    "ticker": row["ticker"],
                    "target_price": row["target_price"],
                    "direction": row["direction"],
                    "current_price": current,
                    "triggered_at": now,
                })
        except Exception:
            logger.exception("Alert check error")
```

The `alert_queue` is an `asyncio.Queue` shared between the check loop and the SSE generator.

### Passing the queue to the SSE generator

The `create_stream_router()` factory in `stream.py` currently takes only `price_cache`. Extend it to accept an optional `alert_queue: asyncio.Queue | None = None`. The `_generate_events()` generator checks the queue each loop cycle with `alert_queue.get_nowait()` inside a try/except `asyncio.QueueEmpty`.

This is the **minimal change** to `stream.py`: one extra parameter, one `try/except` block inside the existing loop.

### Lifespan wiring

In `main.py` lifespan:
```python
alert_queue: asyncio.Queue = asyncio.Queue()
app.state.alert_queue = alert_queue

alert_task = asyncio.create_task(
    _alert_check_loop(_price_cache, alert_queue), name="alert-check"
)
# ... yield ...
alert_task.cancel()
```

Pass `alert_queue` to `create_stream_router(_price_cache, alert_queue)`.

## API Endpoints

All under a new router `backend/app/routes/alerts.py`, prefix `/api/alerts`:

| Method | Path | Request body | Response |
|--------|------|-------------|----------|
| GET | `/api/alerts` | — | `[{id, ticker, target_price, direction, active, triggered_at, created_at}]` |
| POST | `/api/alerts` | `{ticker, target_price, direction}` | `{success, alert: {...}}` |
| DELETE | `/api/alerts/{id}` | — | `{success, id}` |

No PATCH endpoint needed — alerts are one-way (create → fire → done). The frontend can delete a pending alert to cancel it.

**POST validation:**
- `ticker` must be in the watchlist (so we know a price exists for it)
- `target_price` must be > 0
- `direction` must be `'above'` or `'below'`
- Return HTTP 400 with `detail` on validation failure

**GET response** should include both active and recently-triggered alerts (frontend uses active ones to display the bell icon; triggered ones are used only for AI context, not needed in the list). Filter: return all rows for `user_id='default'` ordered by `created_at DESC`, limit 50. Frontend filters client-side on `active=1` for the bell icon state.

## SSE Alert Events

The existing SSE stream uses the default event type (no `event:` line), so `EventSource.onmessage` handles it. Fired alerts must use a **named event** to distinguish them:

```
event: alert_fired
data: {"id": 7, "ticker": "AAPL", "target_price": 200.00, "direction": "above", "current_price": 200.15, "triggered_at": "2026-05-28T12:34:56.789Z"}

```

(Two trailing newlines to terminate the SSE event.)

The `_generate_events()` generator in `stream.py` needs to drain the queue on each loop iteration and yield these named events. Named events are handled in the frontend via `es.addEventListener('alert_fired', handler)` rather than `es.onmessage`.

## Frontend Implementation

### Toast notifications — no extra deps

The project has no toast library. Given the existing dark terminal aesthetic and the "no unnecessary deps" constraint, implement a **custom `ToastContainer` component + `useToast` hook**. This is ~60 lines total:

- `useToast` hook: maintains `toasts: {id, message, ticker, type}[]` state. Exposes `addToast(toast)`. Auto-removes after 4 seconds via `setTimeout`.
- `ToastContainer`: fixed-position `div` at `bottom-4 right-4 z-50`, stacks toasts vertically, each styled with the dark surface + accent-yellow border to match the terminal theme. Dismiss on click.
- No library needed; react-hot-toast and sonner are 10+ kB each and would add an out-of-place visual style.

### WatchlistPanel alert UI — hover bell icon

Looking at the existing ticker row structure (4-column grid: Ticker / Price / Chg% / 40px sparkline+remove), the cleanest addition is a **second icon in the 40px cell** that appears on hover, inside the existing `group` hover mechanism.

Current 40px cell shows: sparkline, and on hover replaces it with a `×` remove button.

New behaviour: on hover, show two icons side-by-side — a `bell` icon (set alert) and a `×` icon (remove), each taking ~20px. Clicking the bell opens a small inline popover/input below the row for `target_price` and `direction`, which submits `POST /api/alerts`.

**Alternative: right-click context menu** — this is less discoverable and harder to implement accessibly. Avoid it.

**The bell icon** should show as filled/amber when the ticker has at least one active alert (derived from `useAlerts` state), so users know at a glance what's set.

### `useAlerts` hook

Separate from `useMarketData`. Lives in `frontend/hooks/useAlerts.ts`:

```typescript
export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [toasts, setToasts] = useState<FiredAlert[]>([]);

  // Load active alerts on mount
  useEffect(() => {
    fetchAlerts().then(setAlerts).catch(() => {});
  }, []);

  function handleAlertFired(fired: FiredAlert) {
    // Remove from active list
    setAlerts(prev => prev.filter(a => a.id !== fired.id));
    // Add toast
    setToasts(prev => [...prev, fired]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== fired.id)), 4000);
  }

  async function createAlert(ticker: string, targetPrice: number, direction: 'above'|'below') {
    const alert = await postAlert({ ticker, targetPrice, direction });
    setAlerts(prev => [...prev, alert]);
  }

  async function deleteAlert(id: number) {
    await apiDeleteAlert(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  return { alerts, toasts, handleAlertFired, createAlert, deleteAlert };
}
```

### SSE integration in `useMarketData`

The existing `useMarketData` hook uses `es.onmessage` for price updates. Add `alert_fired` event handling:

```typescript
es.addEventListener('alert_fired', (event) => {
  const fired = JSON.parse(event.data);
  onAlertFired?.(fired);  // callback prop
});
```

`useMarketData` should accept an optional `onAlertFired` callback. This keeps all SSE wiring in one place. The hook signature becomes:

```typescript
export function useMarketData(options?: { onAlertFired?: (alert: FiredAlert) => void })
```

In `page.tsx`, the `useAlerts` hook provides `handleAlertFired`, which is passed to `useMarketData`.

## AI Context Integration

In `chat.py`, `_portfolio_context()` already builds a multi-block string for the system prompt. Add a **fired alerts block** at the end:

```python
# Inside _portfolio_context(), at the end:
with get_db() as conn:
    fired = conn.execute(
        "SELECT ticker, target_price, direction, triggered_at "
        "FROM price_alerts WHERE user_id=? AND active=0 "
        "AND triggered_at > datetime('now', '-30 minutes') "
        "ORDER BY triggered_at DESC LIMIT 5",
        (USER_ID,),
    ).fetchall()

if fired:
    lines = [
        f"  {r['ticker']} crossed {r['direction']} ${r['target_price']:.2f} at {r['triggered_at']}"
        for r in fired
    ]
    alerts_block = "\nRecent price alerts fired (last 30 min):\n" + "\n".join(lines)
else:
    alerts_block = ""
```

Append `alerts_block` to the returned context string. The existing system prompt already passes this full context block to the LLM — no changes to the prompt template itself are needed.

The 30-minute window ensures the AI references genuinely recent events without drowning in old history. The AI sees this context on every chat call, so it will naturally comment on fired alerts in its next message without being explicitly told.

**Do not** add a `fired_alerts` field to `LLMResponse` or modify structured output — the AI's comment appears in the free-text `message` field, which is the correct place for narrative commentary.

## Validation Architecture

### Manual smoke test sequence:
1. Start backend: `cd backend && uv run uvicorn app.main:app --reload --port 8000`
2. Start frontend: `cd frontend && npm run dev`
3. Set an alert: `POST /api/alerts` `{"ticker":"AAPL","target_price":<current_price+0.01>,"direction":"above"}`
4. Observe SSE stream: `curl -N http://localhost:8000/api/stream/prices` — within ~2 seconds, an `event: alert_fired` line appears
5. Reload page: `GET /api/alerts` returns the alert with `active=0` and `triggered_at` set
6. In chat: send any message — response should reference the fired alert
7. Toast: appears in browser bottom-right within 1 second of SSE event

### Backend unit tests (new `tests/test_alerts.py`):
- `test_create_alert_valid`: POST creates DB row
- `test_create_alert_invalid_ticker_format`: 400 on bad ticker
- `test_alert_fires_above`: simulate price crossing threshold, check `active=0`
- `test_alert_fires_below`: same for direction=below
- `test_alert_idempotent`: once `active=0`, a re-check with same price does not re-fire
- `test_alert_context_in_portfolio`: `_portfolio_context()` returns fired alert line within 30 min window
- `test_alert_context_old_excluded`: fired alert older than 30 min is not included

### E2E Playwright scenario (add to `test/`):
1. App loads → check `GET /api/alerts` returns empty list
2. Set alert at `current_price + 1` (direction=above) via REST
3. Mock price to exceed threshold (or wait for simulator to cross — use a tight margin with the simulator's drift)
4. Poll SSE until `alert_fired` event received
5. Assert `GET /api/alerts/{id}` shows `active=false`

## Risk & Edge Cases

| Risk | Mitigation |
|------|------------|
| Same alert fires twice | `active=0` check at DB read time is atomic per check cycle; the loop skips rows where `active=0` |
| Alert fires while SSE client is disconnected | The `asyncio.Queue` accumulates fired events; when client reconnects, the new SSE connection gets a fresh queue. Missed alerts during disconnection are not replayed. Accept this: alerts also show in `GET /api/alerts` history so users can see them. |
| Multiple SSE clients (future) | Current architecture: one global queue, last client gets the event. Phase 11 is single-user; document this limitation. For multi-client: use a list of queues (fan-out). |
| Alert set for ticker not in watchlist | Validate on POST: check `watchlist` table for ticker. Return 400 if not found. |
| Very tight alert (e.g., target = current price exactly) | Fires on the next tick. Acceptable — user set a precise level. |
| Max alerts | No enforced limit needed for single-user prototype. Add a soft limit of 50 active alerts per user to avoid O(N) DB reads on every tick. Return 400 if exceeded. |
| Alert set for ticker with no current price (just added) | `price_cache.get_price()` returns None; skip check silently until price arrives. |
| DB write contention | SQLite WAL mode is already enabled. The check loop does a read + conditional write per tick; this is well within SQLite's write throughput. |
| Direction inference confusion | Make `direction` an explicit required field in the POST body (not inferred from comparison to current price). This avoids ambiguity and is simpler. |
| Toast dismissed vs auto-expire | Implement both: 4-second auto-dismiss and click-to-dismiss. Do not use `window.Notification` (requires browser permission; too heavyweight for this use case). |

## RESEARCH COMPLETE
