"""Price alerts CRUD endpoints."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_db

USER_ID = "default"
MAX_ACTIVE_ALERTS = 50

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertCreateBody(BaseModel):
    ticker: str
    target_price: float
    direction: str


@router.get("")
def get_alerts():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, user_id, ticker, target_price, direction, active, triggered_at, created_at "
            "FROM price_alerts WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
            (USER_ID,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "user_id": r["user_id"],
            "ticker": r["ticker"],
            "target_price": r["target_price"],
            "direction": r["direction"],
            "active": bool(r["active"]),
            "triggered_at": r["triggered_at"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@router.post("")
def create_alert(body: AlertCreateBody):
    ticker = body.ticker.strip().upper()
    if not re.match(r"^[A-Z]{1,5}$", ticker):
        raise HTTPException(status_code=400, detail="Ticker must be 1-5 uppercase letters")
    if body.target_price <= 0:
        raise HTTPException(status_code=400, detail="target_price must be positive")
    if body.direction not in ("above", "below"):
        raise HTTPException(status_code=400, detail="direction must be 'above' or 'below'")

    with get_db() as conn:
        wl = conn.execute(
            "SELECT id FROM watchlist WHERE user_id=? AND ticker=?", (USER_ID, ticker)
        ).fetchone()
        if wl is None:
            raise HTTPException(status_code=400, detail="Ticker not in watchlist")

        count = conn.execute(
            "SELECT COUNT(*) FROM price_alerts WHERE user_id=? AND active=1", (USER_ID,)
        ).fetchone()[0]
        if count >= MAX_ACTIVE_ALERTS:
            raise HTTPException(status_code=400, detail="Maximum 50 active alerts reached")

        now = datetime.now(timezone.utc).isoformat()
        cur = conn.execute(
            "INSERT INTO price_alerts (user_id, ticker, target_price, direction, active, created_at) "
            "VALUES (?, ?, ?, ?, 1, ?)",
            (USER_ID, ticker, body.target_price, body.direction, now),
        )
        alert_id = cur.lastrowid

    return {
        "success": True,
        "alert": {
            "id": alert_id,
            "ticker": ticker,
            "target_price": body.target_price,
            "direction": body.direction,
            "active": True,
            "triggered_at": None,
            "created_at": now,
        },
    }


@router.delete("/{alert_id}")
def delete_alert(alert_id: int):
    with get_db() as conn:
        result = conn.execute(
            "DELETE FROM price_alerts WHERE user_id=? AND id=?", (USER_ID, alert_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "id": alert_id}
