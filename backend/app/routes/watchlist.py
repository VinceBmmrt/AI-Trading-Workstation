"""Watchlist CRUD endpoints."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..db import get_db

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

USER_ID = "default"


class AddTickerBody(BaseModel):
    ticker: str


@router.get("")
def get_watchlist(request: Request):
    price_cache = request.app.state.price_cache
    with get_db() as conn:
        rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id=? ORDER BY added_at", (USER_ID,)
        ).fetchall()

    result = []
    for row in rows:
        ticker = row["ticker"]
        update = price_cache.get(ticker)
        result.append({
            "ticker": ticker,
            "price": update.price if update else None,
            "change_percent": update.change_percent if update else None,
            "direction": update.direction if update else None,
        })
    return result


@router.post("")
async def add_ticker(body: AddTickerBody, request: Request):
    ticker = body.ticker.upper().strip()
    if not re.match(r"^[A-Z]{1,5}$", ticker):
        raise HTTPException(status_code=400, detail="Ticker must be 1-5 uppercase letters")

    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at) VALUES (?,?,?)",
            (USER_ID, ticker, datetime.now(timezone.utc).isoformat()),
        )

    source = request.app.state.market_source
    await source.add_ticker(ticker)

    current_price = request.app.state.price_cache.get_price(ticker)
    return {"success": True, "ticker": ticker, "current_price": current_price}


@router.delete("/{ticker}")
async def remove_ticker(ticker: str, request: Request):
    ticker = ticker.upper().strip()

    with get_db() as conn:
        result = conn.execute(
            "DELETE FROM watchlist WHERE user_id=? AND ticker=?", (USER_ID, ticker)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"{ticker} not in watchlist")

    await request.app.state.market_source.remove_ticker(ticker)
    return {"success": True, "ticker": ticker}
