"""Portfolio endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..db import execute_trade, get_db, take_snapshot

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

USER_ID = "default"


class TradeBody(BaseModel):
    ticker: str
    quantity: float
    side: str  # "buy" or "sell"


def _build_portfolio(price_cache) -> dict:
    """Return current portfolio as a dict."""
    with get_db() as conn:
        profile = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id=?", (USER_ID,)
        ).fetchone()
        rows = conn.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id=?", (USER_ID,)
        ).fetchall()

    cash = profile["cash_balance"]
    positions = []
    holdings_value = 0.0

    for row in rows:
        ticker, qty, avg_cost = row["ticker"], row["quantity"], row["avg_cost"]
        price = price_cache.get_price(ticker) or avg_cost
        current_value = round(qty * price, 2)
        unrealized_pnl = round(current_value - qty * avg_cost, 2)
        pnl_pct = round((price - avg_cost) / avg_cost * 100, 2) if avg_cost > 0 else 0.0
        holdings_value += current_value
        positions.append({
            "ticker": ticker,
            "quantity": qty,
            "avg_cost": avg_cost,
            "current_price": price,
            "current_value": current_value,
            "unrealized_pnl": unrealized_pnl,
            "pnl_percent": pnl_pct,
        })

    return {
        "cash_balance": cash,
        "positions": positions,
        "holdings_value": round(holdings_value, 2),
        "total_value": round(cash + holdings_value, 2),
    }


@router.get("")
def get_portfolio(request: Request):
    return _build_portfolio(request.app.state.price_cache)


@router.post("/trade")
def trade(body: TradeBody, request: Request):
    price_cache = request.app.state.price_cache
    ticker = body.ticker.upper().strip()

    if body.side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="side must be 'buy' or 'sell'")
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")

    price = price_cache.get_price(ticker)
    if price is None:
        raise HTTPException(status_code=400, detail=f"No price available for {ticker}")

    try:
        trade_record = execute_trade(
            user_id=USER_ID, ticker=ticker, side=body.side,
            quantity=body.quantity, price=price,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    take_snapshot(USER_ID, price_cache)

    return {
        "success": True,
        "trade": trade_record,
        "portfolio": _build_portfolio(price_cache),
    }


@router.get("/history")
def get_history():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots "
            "WHERE user_id=? ORDER BY recorded_at ASC",
            (USER_ID,),
        ).fetchall()
    return [{"total_value": r["total_value"], "recorded_at": r["recorded_at"]} for r in rows]
