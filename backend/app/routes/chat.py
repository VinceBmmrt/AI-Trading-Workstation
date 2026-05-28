"""Chat endpoint with LLM integration."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from litellm import acompletion
from pydantic import BaseModel

from ..db import execute_trade, get_db, take_snapshot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

USER_ID = "default"
MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
STARTING_CAPITAL = 10000.0

MOCK_RESPONSE = "Mock mode: your portfolio is ready. Ask me to buy, sell, or analyze your holdings."
MOCK_SUMMARY = "Markets are active with simulated prices; your portfolio is performing normally."


class ChatRequest(BaseModel):
    message: str


class TradeAction(BaseModel):
    ticker: str
    side: str
    quantity: float


class WatchlistChange(BaseModel):
    ticker: str
    action: str  # "add" or "remove"


class LLMResponse(BaseModel):
    message: str
    trades: list[TradeAction] = []
    watchlist_changes: list[WatchlistChange] = []


def _portfolio_context(price_cache, session_baselines: dict[str, float] | None = None) -> str:
    with get_db() as conn:
        profile = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id=?", (USER_ID,)
        ).fetchone()
        positions = conn.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id=?", (USER_ID,)
        ).fetchall()
        watchlist = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id=?", (USER_ID,)
        ).fetchall()

    cash = profile["cash_balance"]
    holdings = 0.0
    pos_data = []
    for row in positions:
        ticker, qty, avg = row["ticker"], row["quantity"], row["avg_cost"]
        price = price_cache.get_price(ticker) or avg
        value = round(qty * price, 2)
        holdings += value
        pos_data.append((ticker, qty, avg, price, value))

    total = cash + holdings
    delta = total - STARTING_CAPITAL
    delta_pct = delta / STARTING_CAPITAL * 100
    delta_sign = "+" if delta >= 0 else ""

    pos_lines = []
    for ticker, qty, avg, price, value in pos_data:
        pnl = round(value - qty * avg, 2)
        pnl_sign = "+" if pnl >= 0 else ""
        pnl_pct = (price - avg) / avg * 100 if avg != 0 else 0.0
        weight = value / total * 100 if total != 0 else 0.0
        concentration = " ⚠ concentrated" if weight > 25 else ""
        pos_lines.append(
            f"  {ticker}: {qty} shares @ avg ${avg:.2f} -> now ${price:.2f} | "
            f"P&L: {pnl_sign}${pnl:.2f} ({pnl_pct:+.2f}%) | weight: {weight:.1f}%{concentration}"
        )

    wl_tickers = [r["ticker"] for r in watchlist]
    wl = ", ".join(wl_tickers)

    header = (
        f"Cash: ${cash:.2f} | Holdings: ${holdings:.2f} | Total: ${total:.2f} "
        f"(start: ${STARTING_CAPITAL:.2f}, change: {delta_sign}${delta:.2f} / {delta_pct:+.1f}%)"
    )

    movers_block = ""
    if session_baselines:
        movers = []
        for t in wl_tickers:
            baseline = session_baselines.get(t, 0.0)
            if baseline == 0.0:
                continue
            current = price_cache.get_price(t)
            if current is None:
                continue
            movers.append((t, (current - baseline) / baseline * 100))
        movers.sort(key=lambda x: abs(x[1]), reverse=True)
        top3 = movers[:3]
        if top3:
            movers_block = "\nSession movers (top 3): " + " | ".join(
                f"{t}: {pct:+.1f}% session" for t, pct in top3
            )

    return (
        f"{header}\n"
        f"Positions:\n{chr(10).join(pos_lines) or '  (none)'}"
        f"{movers_block}\n"
        f"Watchlist: {wl}"
    )


def _chat_history(limit: int = 10) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT role, content FROM chat_messages WHERE user_id=? "
            "ORDER BY created_at DESC LIMIT ?",
            (USER_ID, limit),
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def _save_message(role: str, content: str, actions: dict | None = None) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (
                str(uuid.uuid4()), USER_ID, role, content,
                json.dumps(actions) if actions else None,
                datetime.now(timezone.utc).isoformat(),
            ),
        )


@router.post("")
async def chat(body: ChatRequest, request: Request):
    price_cache = request.app.state.price_cache
    market_source = request.app.state.market_source

    _save_message("user", body.message)

    if os.environ.get("LLM_MOCK", "").lower() == "true":
        llm_response = LLMResponse(message=MOCK_RESPONSE)
    else:
        context = _portfolio_context(price_cache, getattr(request.app.state, "session_baselines", None))
        system_prompt = (
            "You are Finance Ally, an AI trading assistant for a simulated portfolio platform.\n"
            "Analyze positions, suggest and execute trades, manage the watchlist.\n"
            "Be concise and data-driven. Always respond with valid JSON.\n\n"
            f"PORTFOLIO:\n{context}"
        )
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(_chat_history())
        messages.append({"role": "user", "content": body.message})

        try:
            resp = await acompletion(
                model=MODEL,
                messages=messages,
                response_format=LLMResponse,
                reasoning_effort="low",
                extra_body=EXTRA_BODY,
            )
            llm_response = LLMResponse.model_validate_json(resp.choices[0].message.content)
        except Exception as e:
            logger.error("LLM call failed: %s", e)
            llm_response = LLMResponse(message="I'm having trouble right now. Please try again.")

    # Execute watchlist changes FIRST so new tickers get prices before trades run
    executed_wl = []
    new_tickers_added = False
    for wl in llm_response.watchlist_changes:
        ticker = wl.ticker.upper().strip()
        try:
            if wl.action == "add":
                with get_db() as conn:
                    conn.execute(
                        "INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at) VALUES (?,?,?)",
                        (USER_ID, ticker, datetime.now(timezone.utc).isoformat()),
                    )
                await market_source.add_ticker(ticker)
                executed_wl.append({"ticker": ticker, "action": "add"})
                new_tickers_added = True
            elif wl.action == "remove":
                with get_db() as conn:
                    conn.execute(
                        "DELETE FROM watchlist WHERE user_id=? AND ticker=?", (USER_ID, ticker)
                    )
                await market_source.remove_ticker(ticker)
                executed_wl.append({"ticker": ticker, "action": "remove"})
        except Exception as e:
            logger.warning("Watchlist change failed for %s: %s", ticker, e)

    # Give the simulator a moment to generate prices for newly-added tickers
    if new_tickers_added and llm_response.trades:
        await asyncio.sleep(0.6)

    # Execute trades
    executed_trades, trade_errors = [], []
    for t in llm_response.trades:
        ticker = t.ticker.upper().strip()
        price = price_cache.get_price(ticker)
        if price is None:
            trade_errors.append(f"No price available for {ticker} — add it to your watchlist first")
            continue
        try:
            record = execute_trade(USER_ID, ticker, t.side, t.quantity, price)
            executed_trades.append(record)
        except ValueError as e:
            trade_errors.append(str(e))

    if executed_trades:
        take_snapshot(USER_ID, price_cache)

    actions = {
        "trades": executed_trades,
        "trade_errors": trade_errors,
        "watchlist_changes": executed_wl,
    }
    _save_message("assistant", llm_response.message, actions)

    return {"message": llm_response.message, "actions": actions}


@router.get("/messages")
async def get_messages(after_ts: str | None = None):
    with get_db() as conn:
        if after_ts is not None:
            rows = conn.execute(
                "SELECT id, role, content, actions, created_at FROM chat_messages "
                "WHERE user_id=? AND created_at > ? ORDER BY created_at ASC",
                (USER_ID, after_ts),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, role, content, actions, created_at FROM chat_messages "
                "WHERE user_id=? ORDER BY created_at DESC LIMIT 20",
                (USER_ID,),
            ).fetchall()
            rows = list(reversed(rows))
    return [
        {
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "actions": json.loads(r["actions"]) if r["actions"] else None,
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@router.get("/market-summary")
async def market_summary(request: Request):
    generated_at = datetime.now(timezone.utc).isoformat()
    try:
        price_cache = request.app.state.price_cache
        baselines = getattr(request.app.state, "session_baselines", None)
        if os.environ.get("LLM_MOCK", "").lower() == "true":
            return {"summary": MOCK_SUMMARY, "generated_at": generated_at}
        context = _portfolio_context(price_cache, baselines)
        messages = [
            {
                "role": "system",
                "content": "You are Finance Ally. Respond with a single-sentence market summary, max 30 words. Plain text only.",
            },
            {
                "role": "user",
                "content": f"{context}\nGive me a one-sentence market summary.",
            },
        ]
        resp = await acompletion(
            model=MODEL,
            messages=messages,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
        summary = resp.choices[0].message.content.strip()
    except Exception:
        logger.exception("market-summary endpoint failed")
        return {"summary": "Market data loading...", "generated_at": generated_at}
    return {"summary": summary, "generated_at": generated_at}
