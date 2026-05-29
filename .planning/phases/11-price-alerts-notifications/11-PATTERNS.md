# Phase 11 — Pattern Map

## backend/app/routes/alerts.py
**Analog:** `backend/app/routes/watchlist.py`
**Key patterns to replicate:**
```python
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from ..db import get_db

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
USER_ID = "default"

class AlertCreateBody(BaseModel):
    ticker: str
    trigger_price: float
    alert_type: str  # "above" or "below"

@router.get("")
def get_alerts(request: Request):
    price_cache = request.app.state.price_cache
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, ticker, trigger_price, alert_type, created_at "
            "FROM price_alerts WHERE user_id=? ORDER BY created_at",
            (USER_ID,)
        ).fetchall()
    return [...]

@router.post("")
async def create_alert(body: AlertCreateBody, request: Request):
    ticker = body.ticker.upper().strip()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO price_alerts (user_id, ticker, trigger_price, alert_type, created_at) "
            "VALUES (?,?,?,?,?)",
            (USER_ID, ticker, body.trigger_price, body.alert_type, 
             datetime.now(timezone.utc).isoformat())
        )
    return {"success": True, "alert_id": alert_id}

@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, request: Request):
    with get_db() as conn:
        result = conn.execute(
            "DELETE FROM price_alerts WHERE user_id=? AND id=?",
            (USER_ID, alert_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}
```

---

## backend/app/db.py (price_alerts table)
**Analog:** Tables in `SCHEMA_SQL`

Add to `SCHEMA_SQL` string:
```python
CREATE TABLE IF NOT EXISTS price_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    trigger_price REAL NOT NULL,
    alert_type TEXT NOT NULL,
    fired BOOLEAN DEFAULT 0,
    fired_at TEXT,
    created_at TEXT NOT NULL
);
```

Database patterns observed:
- Use `TEXT PRIMARY KEY` with `str(uuid.uuid4())` for IDs
- Use `TEXT NOT NULL DEFAULT 'default'` for user_id
- Use ISO 8601 timestamps: `datetime.now(timezone.utc).isoformat()`
- Use BOOLEAN (0/1) for flags

---

## backend/app/main.py — background alert check loop
**Analog:** `_proactive_monitor_loop()` and `_snapshot_loop()`

```python
async def _alert_check_loop(price_cache: PriceCache) -> None:
    """Monitor price alerts; fire when thresholds crossed."""
    while True:
        await asyncio.sleep(5.0)
        try:
            with get_db() as conn:
                rows = conn.execute(
                    "SELECT id, ticker, trigger_price, alert_type "
                    "FROM price_alerts WHERE user_id='default' AND fired=0"
                ).fetchall()
            
            for row in rows:
                ticker = row["ticker"]
                current_price = price_cache.get_price(ticker)
                if current_price is None:
                    continue
                
                should_fire = False
                if row["alert_type"] == "above" and current_price >= row["trigger_price"]:
                    should_fire = True
                elif row["alert_type"] == "below" and current_price <= row["trigger_price"]:
                    should_fire = True
                
                if should_fire:
                    now = datetime.now(timezone.utc).isoformat()
                    with get_db() as conn:
                        conn.execute(
                            "UPDATE price_alerts SET fired=1, fired_at=? WHERE id=?",
                            (now, row["id"])
                        )
                    asyncio.create_task(_handle_fired_alert(row, current_price))
        except Exception:
            logger.exception("Alert check loop error")
```

Lifecycle pattern in `lifespan()`:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    source = create_market_data_source(_price_cache)
    await source.start(tickers)
    
    task1 = asyncio.create_task(..., name="task-name")
    
    yield
    
    task1.cancel()
    try:
        await task1
    except asyncio.CancelledError:
        pass
```

---

## backend/app/routes/chat.py — inject alerts into portfolio context
**Analog:** `_portfolio_context()` function

```python
def _portfolio_context(price_cache, session_baselines: dict[str, float] | None = None) -> str:
    with get_db() as conn:
        # ... existing code ...
        alerts = conn.execute(
            "SELECT ticker, trigger_price, alert_type FROM price_alerts "
            "WHERE user_id=? AND fired=0 ORDER BY created_at",
            (USER_ID,)
        ).fetchall()
    
    alert_lines = []
    for a in alerts:
        alert_lines.append(
            f"  {a['ticker']}: alert if price goes {a['alert_type']} ${a['trigger_price']:.2f}"
        )
    
    alerts_block = "\nActive Alerts:\n" + "\n".join(alert_lines) if alert_lines else ""
    
    return (
        f"{header}\n"
        f"Positions:\n{chr(10).join(pos_lines)}\n"
        f"{alerts_block}"
        f"{movers_block}\n"
        f"Watchlist: {wl}"
    )
```

---

## frontend/hooks/useAlerts.ts
**Analog:** `frontend/hooks/usePortfolio.ts`

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAlerts, createAlert, deleteAlert } from "@/lib/api";
import type { Alert } from "@/lib/types";

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const a = await fetchAlerts();
      setAlerts(a);
    } catch (e) {
      console.error("Alerts fetch failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const createNew = useCallback(
    async (ticker: string, triggerPrice: number, alertType: "above" | "below") => {
      try {
        await createAlert(ticker, triggerPrice, alertType);
        await refresh();
      } catch (e) {
        console.error("Create alert failed", e);
        throw e;
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (alertId: string) => {
      try {
        await deleteAlert(alertId);
        await refresh();
      } catch (e) {
        console.error("Delete alert failed", e);
        throw e;
      }
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { alerts, loading, refresh, createNew, remove };
}
```

---

## frontend/lib/types.ts — add Alert interface
**Analog:** Other types in the file

```typescript
export interface Alert {
  id: string;
  ticker: string;
  trigger_price: number;
  alert_type: "above" | "below";
  fired: boolean;
  fired_at?: string;
  created_at: string;
}
```

---

## frontend/lib/api.ts — add alert functions
**Analog:** Existing watchlist and portfolio functions

```typescript
export async function fetchAlerts(): Promise<Alert[]> {
  const r = await fetch(`${BASE}/api/alerts`);
  if (!r.ok) throw new Error("Failed to fetch alerts");
  return r.json();
}

export async function createAlert(
  ticker: string,
  triggerPrice: number,
  alertType: "above" | "below"
): Promise<void> {
  const r = await fetch(`${BASE}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, trigger_price: triggerPrice, alert_type: alertType }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail ?? "Failed to create alert");
  }
}

export async function deleteAlert(alertId: string): Promise<void> {
  const r = await fetch(`${BASE}/api/alerts/${alertId}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete alert");
}
```

---

## frontend/components/ToastNotification.tsx
**Analog:** Inferred from React patterns

```typescript
"use client";

import { useState, useEffect } from "react";

interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  duration?: number;
}

export default function ToastNotification({ toast }: { toast: Toast | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast || !visible) return null;

  const bgColor = {
    info: "bg-blue/20",
    success: "bg-green/20",
    warning: "bg-yellow/20",
    error: "bg-red/20",
  }[toast.type];

  const textColor = {
    info: "text-blue",
    success: "text-green",
    warning: "text-yellow",
    error: "text-red",
  }[toast.type];

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded ${bgColor} ${textColor} font-mono text-sm`}>
      {toast.message}
    </div>
  );
}
```

---

## frontend/components/WatchlistPanel.tsx — add bell icon for alerts
**Analog:** Existing remove (×) button pattern

To add a bell icon for alerts in the row:
```typescript
<button
  onClick={(e) => { e.stopPropagation(); setShowAlertPopover(true); }}
  className="absolute top-1 right-6 opacity-0 group-hover:opacity-100 text-text-dim hover:text-accent text-lg transition-opacity"
  aria-label={`Alert for ${ticker}`}
>
  🔔
</button>
```

---

## frontend/components/AlertPopover.tsx (NEW)
**Pattern reference:** Similar to TradeBar modal interaction

```typescript
"use client";

import { useState } from "react";

interface Props {
  ticker: string;
  currentPrice: number | null;
  onClose: () => void;
  onAlertCreated: (alert: any) => void;
}

export default function AlertPopover({
  ticker,
  currentPrice,
  onClose,
  onAlertCreated,
}: Props) {
  const [alertType, setAlertType] = useState<"above" | "below">("above");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const price = parseFloat(triggerPrice);
    if (!price || price <= 0) return;
    
    setLoading(true);
    try {
      onAlertCreated({ ticker, trigger_price: price, alert_type: alertType });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onClose}>
      <div className="bg-surface border border-border rounded p-4 max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-3">{ticker} Price Alert</h3>
        
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setAlertType("above")}
            className={`flex-1 px-2 py-1 rounded text-xs font-mono transition ${
              alertType === "above" ? "bg-blue text-white" : "bg-surface-2 text-text-dim"
            }`}
          >
            ABOVE
          </button>
          <button
            onClick={() => setAlertType("below")}
            className={`flex-1 px-2 py-1 rounded text-xs font-mono transition ${
              alertType === "below" ? "bg-blue text-white" : "bg-surface-2 text-text-dim"
            }`}
          >
            BELOW
          </button>
        </div>
        
        <input
          type="number"
          value={triggerPrice}
          onChange={(e) => setTriggerPrice(e.target.value)}
          placeholder={`Enter price (current: ${currentPrice?.toFixed(2) ?? "—"})`}
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm font-mono mb-3"
        />
        
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-2 py-1 bg-surface-2 rounded text-xs font-mono">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={loading || !triggerPrice}
            className="flex-1 px-2 py-1 bg-blue/25 rounded text-xs font-mono text-blue disabled:opacity-50"
          >
            {loading ? "…" : "Set Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## frontend/app/page.tsx — wire useAlerts hook
**Analog:** How useMarketData and usePortfolio are used

```typescript
import { useAlerts } from "@/hooks/useAlerts";

export default function TradingPage() {
  const market = useMarketData();
  const portfolio = usePortfolio();
  const alerts = useAlerts();
  
  return (
    // Pass alerts to WatchlistPanel or keep in state for alert popovers
  );
}
```

---

## backend/app/main.py — register alerts router
**Analog:** How other routers are registered

```python
from .routes import chat, health, portfolio, watchlist, alerts

# In app setup:
app.include_router(health.router)
app.include_router(create_stream_router(_price_cache))
app.include_router(watchlist.router)
app.include_router(alerts.router)
app.include_router(portfolio.router)
app.include_router(chat.router)
```

---

## PATTERN MAPPING COMPLETE

### Key Patterns Summary

**Backend Route Structure:**
- `APIRouter(prefix="/api/...", tags=[...])` from FastAPI
- Extract user context via `request: Request`
- Access state via `request.app.state`
- Use `get_db()` context manager
- Validate input with Pydantic BaseModel
- Return JSON or raise HTTPException

**Database Pattern:**
- Add table to SCHEMA_SQL
- Use UUID for IDs: `str(uuid.uuid4())`
- Always include user_id, created_at
- Use ISO 8601 timestamps
- Use BOOLEAN (0/1) for flags

**Background Tasks:**
- Define async functions in main.py
- Create with `asyncio.create_task(..., name="...")`
- Poll with `await asyncio.sleep(interval)`
- Cancel and await in cleanup
- Wrap in try-except with logger.exception()

**Frontend Hook Pattern:**
- useState for data + loading
- useCallback for actions
- useEffect with interval polling
- Return state object with actions

**Frontend API Pattern:**
- Fetch functions in lib/api.ts
- Use NEXT_PUBLIC_API_BASE
- Check r.ok before parsing
- Throw Error with response.detail

**Component Interaction:**
- Hover overlay buttons with opacity-0 -> opacity-100
- Modal: fixed overlay with bg-black/50, stop propagation, close on outer click

