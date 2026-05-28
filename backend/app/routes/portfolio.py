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


@router.get("/trades")
def get_trades():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, ticker, side, quantity, price, executed_at "
            "FROM trades WHERE user_id=? ORDER BY executed_at DESC",
            (USER_ID,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "ticker": r["ticker"],
            "side": r["side"],
            "quantity": r["quantity"],
            "price": r["price"],
            "total": round(r["quantity"] * r["price"], 2),
            "executed_at": r["executed_at"],
        }
        for r in rows
    ]


STARTING_CAPITAL = 10_000.0


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

    unrealized_pnl = 0.0
    best_ticker, best_pct = None, float("-inf")
    worst_ticker, worst_pct = None, float("inf")

    for row in positions:
        ticker, qty, avg_cost = row["ticker"], row["quantity"], row["avg_cost"]
        price = price_cache.get_price(ticker) or avg_cost
        upnl = (price - avg_cost) * qty
        unrealized_pnl += upnl
        pct = (price - avg_cost) / avg_cost * 100 if avg_cost > 0 else 0.0
        if pct > best_pct:
            best_pct, best_ticker = pct, ticker
        if pct < worst_pct:
            worst_pct, worst_ticker = pct, ticker

    unrealized_pnl = round(unrealized_pnl, 2)
    total_value = round(cash + sum(
        (price_cache.get_price(r["ticker"]) or r["avg_cost"]) * r["quantity"]
        for r in positions
    ), 2)
    total_return_pct = round((total_value - STARTING_CAPITAL) / STARTING_CAPITAL * 100, 2)

    buy_count = sum(1 for r in trades if r["side"] == "buy")
    sell_count = sum(1 for r in trades if r["side"] == "sell")

    # Win rate: closed positions (sells) where sell price > avg_cost at time of sale
    # Approximate: count sells where received > invested for that ticker
    ticker_totals: dict[str, dict] = {}
    for r in trades:
        t = r["ticker"]
        if t not in ticker_totals:
            ticker_totals[t] = {"invested": 0.0, "received": 0.0}
        if r["side"] == "buy":
            ticker_totals[t]["invested"] += r["quantity"] * r["price"]
        else:
            ticker_totals[t]["received"] += r["quantity"] * r["price"]

    closed = [(v["received"], v["invested"]) for v in ticker_totals.values() if v["received"] > 0]
    wins = sum(1 for recv, inv in closed if recv > inv)
    win_rate = round(wins / len(closed) * 100, 1) if closed else 0.0

    return {
        "total_trades": len(trades),
        "total_invested": round(total_invested, 2),
        "total_received": round(total_received, 2),
        "realized_pnl": realized_pnl,
        "unrealized_pnl": unrealized_pnl,
        "total_return_pct": total_return_pct,
        "best_performer": best_ticker,
        "worst_performer": worst_ticker,
        "win_rate": win_rate,
        "buy_count": buy_count,
        "sell_count": sell_count,
    }
