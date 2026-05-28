# Phase 10: AI Intelligence Upgrade — Research

**Researched:** 2026-05-28
**Phase:** 10 — AI Intelligence Upgrade

---

## Summary

Phase 10 makes the AI assistant proactive and context-aware. Four distinct features:
1. **Proactive commentary** — backend detects >2% session moves, triggers an LLM call, pushes a "proactive" message to the frontend
2. **Market summary card** — page load fetches a new endpoint that generates an AI summary of current prices + portfolio
3. **Slash commands** — `/analyze`, `/rebalance`, `/risk` parsed client-side, sent to the existing `/api/chat` endpoint with a structured prefix, handled server-side
4. **Richer LLM context** — enriched system prompt with risk concentration, largest mover, P&L breakdown

Backend changes are modest; the main complexity is the proactive alert delivery mechanism. No new background task frameworks needed — extend the existing asyncio pattern in `main.py`.

---

## Existing Code Inventory

| File | Role | Phase 10 relevance |
|------|------|-------------------|
| `backend/app/routes/chat.py` | Core LLM integration | Extend `_portfolio_context()` with richer data; add slash command routing; add `POST /api/chat/proactive` internal helper or extend existing route |
| `backend/app/main.py` | FastAPI lifespan, background tasks | Add `_proactive_alert_loop` alongside `_snapshot_loop`; attach `app.state.alert_queue` |
| `backend/app/market/cache.py` | Thread-safe price cache | `PriceCache.get_all()` returns all `PriceUpdate` objects — `change_percent` is tick-to-tick, not session-wide. Need session baseline tracking. |
| `backend/app/market/models.py` | `PriceUpdate` dataclass | `change_percent` = `(price - previous_price) / previous_price * 100` — **tick-to-tick only**, not session |
| `backend/app/market/seed_prices.py` | Seed prices | Session baseline = `SEED_PRICES` dict (simulator mode). Need to expose this or track separately. |
| `backend/app/market/simulator.py` | GBM simulator | `_prices` dict has current prices; no built-in session tracking. `SEED_PRICES` are the starting prices. |
| `backend/app/db.py` | SQLite operations | `chat_messages` table stores all messages; `_save_message()` in chat.py persists proactive messages too |
| `frontend/components/ChatPanel.tsx` | Chat UI | Currently pulls messages from local React state; needs a way to inject externally-triggered messages |
| `frontend/app/page.tsx` | Main page | Where to mount market summary card; currently has no polling for proactive messages |
| `frontend/hooks/useMarketData.ts` | SSE connection | Could be extended to handle a new SSE event type, or a new polling hook added |
| `frontend/lib/api.ts` | API client | Add `fetchMarketSummary()`, `fetchProactiveMessages()` |
| `frontend/lib/types.ts` | TypeScript types | Add `MarketSummary`, `ProactiveMessage` types |

---

## Key Problem: Session Change % Tracking

The `PriceUpdate.change_percent` property is **tick-to-tick** (last 500ms), not session-wide. To detect a >2% session move:

- **Simulator mode**: `SEED_PRICES` in `seed_prices.py` are the starting prices. The backend can compare `current_price / seed_price - 1` against the 2% threshold.
- **Massive API mode**: Uses real market data. Session baseline = closing price from prior day. For this phase, the simplest approach is: track the price at backend startup per ticker (snapshot the cache after first fill) as the session baseline.

**Decision: Add a `session_baseline: dict[str, float]` to `PriceCache` or as a separate dict in `main.py`.** Populated once after `source.start()` fills the cache. Updated on each 500ms cycle by the proactive monitor.

Session change formula:
```python
session_pct = (current_price - baseline) / baseline * 100
```

---

## Feature 1: Proactive Commentary

### Architecture Decision: Backend Background Task + SSE or Polling?

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| A. Backend background task writes to a queue; new SSE endpoint `/api/stream/alerts` streams them | Real-time push, no client polling | New SSE connection, more frontend complexity |
| B. Backend task writes to a queue; existing `/api/stream/prices` emits a new `event: alert` type | Single SSE connection reused | Changes the prices SSE format; frontend currently only handles `onmessage` (unnamed events) |
| C. Backend task writes to `chat_messages` table with `role="assistant"`; frontend polls `/api/chat/messages` | Simple, persistent, uses existing DB | 1-5s polling latency acceptable; fits "within 5 seconds" criterion |
| D. Backend task triggers LLM call, result goes into an in-memory asyncio queue; frontend polls a new endpoint | Simple backend, no SSE changes | Polling. Messages lost on restart (in-memory) |

**Decision: Option C — write to `chat_messages` DB table, frontend polls.**

Rationale:
- Fits within the 5-second success criterion (poll every 3s)
- Proactive messages persist across page refresh — consistent with existing chat history
- No new SSE event types — no changes to `useMarketData.ts` SSE parsing
- ChatPanel already shows messages from state; just needs to poll for new ones
- Simplest reliable approach

**Backend flow:**
```
_proactive_monitor_loop (asyncio task, every 3s)
  → read price_cache.get_all()
  → compute session_pct for each ticker
  → if abs(session_pct) > 2% AND ticker not in recently_alerted set
      → build LLM prompt with portfolio context + move details
      → call LLM (async, non-blocking)
      → save response to chat_messages (role="assistant", actions={"proactive": true, "ticker": "AAPL"})
      → add ticker to recently_alerted (cooldown: 10 minutes per ticker)
  → clear tickers from recently_alerted after cooldown expires
```

**Frontend flow:**
```
ChatPanel mounts
  → starts polling GET /api/chat/messages?since=<last_id> every 5s
  → receives new assistant messages
  → injects them into local messages state with a "proactive" badge
```

### New Backend Endpoint

```
GET /api/chat/messages?after=<message_id>
```
Returns: `[{id, role, content, actions, created_at}]` — messages after the given ID (for polling).

The ChatPanel tracks the ID of the last message it received. On each poll, it sends that ID. The backend returns any newer messages not yet seen by the client.

### LLM Budget for Proactive Calls

- Max 1 LLM call per ticker per 10-minute window (cooldown tracked in memory as `dict[str, float]` keyed by ticker, value = timestamp of last alert)
- Multiple tickers moving at once: process them one at a time, sequential LLM calls (fast with Cerebras)
- LLM_MOCK mode: skip proactive LLM calls entirely (emit a canned mock message)
- Proactive prompt is a separate, cheaper prompt (no conversation history needed):

```python
system = "You are Finance Ally. Be very brief (1-2 sentences)."
user = f"AAPL just moved +3.2% this session (now $195.20). The user holds 10 shares. Note this briefly."
```

### Data Flow Diagram: Proactive Commentary

```
[SimulatorDataSource] ──500ms──► [PriceCache]
                                      │
                          ┌───────────┘ (every 3s)
                          ▼
              [_proactive_monitor_loop]
                    │
                    ├── get_all() → compute session_pct
                    ├── filter: abs(pct) > 2% AND not in cooldown
                    │
                    ▼
            [LLM call via acompletion]
                    │
                    ▼
            [_save_message("assistant", ..., actions={"proactive": True})]
                    │
                    ▼
            [chat_messages SQLite table]
                    │
          (frontend polls every 5s)
                    │
                    ▼
            [GET /api/chat/messages?after=<last_id>]
                    │
                    ▼
            [ChatPanel injects new messages]
```

---

## Feature 2: Market Summary Card

### Architecture Decision: New GET endpoint, fetched on page load

**Decision: `GET /api/chat/market-summary`** — synchronous (non-streaming) endpoint that:
1. Reads all current prices from `price_cache.get_all()`
2. Reads portfolio context (positions, cash)
3. Calls the LLM with a focused prompt asking for a brief market summary
4. Returns `{summary: string, generated_at: string}`

**Frontend:** `page.tsx` calls this endpoint once on mount (inside a `useEffect`). The summary card appears in the layout between the Header and the main content area, or as an overlay on the chart — a non-intrusive one-liner card.

**Caching:** The endpoint itself is not cached (each call generates a fresh summary). The frontend fetches once on mount; no auto-refresh. The user can manually refresh if needed (optional).

**LLM_MOCK mode:** Return a canned summary string.

### Data Contract

```
GET /api/chat/market-summary

Response 200:
{
  "summary": "Markets mixed this session — TSLA up 3.1%, JPM down 2.4%. Your portfolio is up $145 (+1.4%). Notable: NVDA concentration at 38% of holdings.",
  "generated_at": "2026-05-28T10:30:00Z"
}
```

### LLM Prompt for Market Summary

```
system: "You are Finance Ally. Respond with a single sentence market summary (max 30 words)."
user: "Current prices: AAPL $192 (+1.2%), TSLA $258 (+3.1%), JPM $191 (-2.4%)...
       Portfolio: 10 AAPL, 5 TSLA, $3,200 cash. Total value $9,840 (-1.6% from start).
       Give me a one-sentence market summary."
```

### Frontend Placement

Market summary card in the header area — a slim banner below `<Header>` and above the main grid:

```
┌──────────────────────────────────────────────────────────────┐
│ Header (portfolio value, cash, connection status)            │
├──────────────────────────────────────────────────────────────┤
│ AI SUMMARY  Markets mixed today — TSLA +3.1%, NVDA leads...  │  ← new slim card
├──────────────────────────────────────────────────────────────┤
│ Left column │ Center chart+portfolio │ Right chat panel      │
```

Component: `MarketSummaryBanner.tsx` — a single-line strip. Styled with the accent yellow color, small mono font. Shows a loading skeleton while waiting.

### Data Flow Diagram: Market Summary

```
[page.tsx mounts]
      │ useEffect (once)
      ▼
[GET /api/chat/market-summary]
      │
      ├── price_cache.get_all() → all prices + session_pct
      ├── _portfolio_context() → cash, positions
      ├── LLM call (acompletion, ~1s with Cerebras)
      └── return {summary, generated_at}
      │
      ▼
[MarketSummaryBanner renders summary text]
```

---

## Feature 3: Slash Commands

### Architecture Decision: Client-side detection, server-side execution

**Client-side parsing:** In `ChatPanel.tsx`, before calling `sendChat()`, check if `input.trim()` starts with `/`. If so, expand the slash command to a full English prompt:

```typescript
function expandSlashCommand(input: string): string {
  const cmd = input.trim().toLowerCase();
  if (cmd === "/analyze")   return "Analyze my portfolio in detail — show risk concentration, P&L by position, and key observations.";
  if (cmd === "/rebalance") return "Suggest a specific rebalancing plan for my portfolio with trade recommendations and reasoning.";
  if (cmd === "/risk")      return "Give me a risk assessment of my current portfolio — concentration, volatility exposure, and suggestions to reduce risk.";
  return input;  // pass through if not a known slash command
}
```

This is the simplest approach: zero backend changes needed. The LLM receives a well-formed English prompt and responds normally via the existing `/api/chat` endpoint. Structured output and auto-execution still work.

**Why not server-side parsing?** The slash commands map directly to English prompts. No new structured output schemas are needed. Client-side keeps the backend unchanged and enables easy addition of new commands.

**UX: Autocomplete hint.** When the input starts with `/`, show a small suggestion dropdown above the input with the available commands. Implemented as a conditional `<div>` in ChatPanel.

**Slash command hint UI:**
```
┌────────────────────────────────────────┐
│ /analyze  — portfolio breakdown        │
│ /rebalance — suggest trades            │
│ /risk     — risk assessment            │
└────────────────────────────────────────┘
[ /ana|                                   ] [▲]
```

### Backend: Richer System Prompt for Slash Commands

The `/analyze` and `/rebalance` commands benefit from more structured context in the system prompt. The enriched context (Feature 4 below) handles this naturally — no special routing needed.

---

## Feature 4: Richer Portfolio Context in System Prompt

### Current `_portfolio_context()` output

```
Cash: $3200.00 | Holdings: $6800.00 | Total: $10000.00
Positions:
  AAPL: 10 shares @ avg $190.00, now $192.00 (+$20.00)
  NVDA: 5 shares @ avg $800.00, now $820.00 (+$100.00)
Watchlist: AAPL, GOOGL, MSFT, ...
```

### Enhanced `_portfolio_context()` output

Add the following computed fields:

**Risk Concentration:** For each position, `pct_of_portfolio = position_value / total_value * 100`. Flag any position >25% as "concentrated".

**Largest Mover:** Scan all watchlist tickers in the price cache for the largest absolute `session_pct` change. Report the top mover.

**Richer P&L format:** Include `pnl_percent` for each position alongside dollar P&L.

**Session data:** Include session baseline comparison for watchlist tickers.

Sample enhanced output:
```
Cash: $3,200.00 | Holdings: $6,800.00 | Total: $10,000.00 (start: $10,000.00, change: $0.00 / 0.0%)

Positions (risk concentration):
  AAPL: 10 shares @ avg $190.00 → now $192.00 | P&L: +$20.00 (+1.05%) | weight: 19.2% of portfolio
  NVDA: 5 shares @ avg $800.00 → now $820.00 | P&L: +$100.00 (+2.50%) | weight: 41.0% of portfolio ⚠ concentrated

Session movers (top 3):
  TSLA: +3.1% session | NVDA: +2.5% session | JPM: -2.1% session

Watchlist: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX
```

### Implementation in `_portfolio_context()`

The function already queries `positions` and `watchlist`. Add:

1. `starting_capital = 10000.0` (same constant as `portfolio.py`)
2. Loop positions: compute `weight = value / total_value * 100`, flag if >25%
3. Read `session_baselines` dict from `request.app.state.session_baselines` (new) or pass it as a parameter. For the chat endpoint, access via `request.app.state`.
4. Sort watchlist tickers by `abs(session_pct)`, take top 3 for "session movers" block.

**Note:** `_portfolio_context()` currently takes only `price_cache` as argument. Need to also pass `session_baselines` dict. Update signature to `_portfolio_context(price_cache, session_baselines: dict[str, float] | None = None)`.

---

## Session Baseline Tracking

### Where to Store It

`app.state.session_baselines: dict[str, float]` — set once in the lifespan after `source.start()`:

```python
# In lifespan, after await source.start(tickers):
await asyncio.sleep(0.1)  # allow first price tick
baselines = {t: _price_cache.get_price(t) or 0.0 for t in tickers}
app.state.session_baselines = baselines
```

New tickers added via watchlist: their baseline = price at time of addition (set in watchlist route or chat route when `add_ticker` is called).

### Accessing Session Baselines

- **Proactive monitor loop:** `baselines` passed as argument
- **Chat endpoint:** accessed via `request.app.state.session_baselines`
- **Market summary endpoint:** accessed via `request.app.state.session_baselines`

---

## New Backend Endpoints Summary

| Method | Path | Description | New? |
|--------|------|-------------|------|
| GET | `/api/chat/messages` | Poll for new messages (query param: `after=<id>`) | New |
| GET | `/api/chat/market-summary` | AI-generated market summary on page load | New |
| POST | `/api/chat` | Existing — unchanged (slash commands sent as plain text) | Modified (richer context) |

### `/api/chat/messages` Response

```json
[
  {
    "id": "uuid",
    "role": "assistant",
    "content": "TSLA just moved +3.1% this session — you hold 5 shares, up $38 unrealized.",
    "actions": {"proactive": true, "ticker": "TSLA"},
    "created_at": "2026-05-28T10:31:00Z"
  }
]
```

The frontend tracks the `id` of the last message it has seen and passes `?after=<id>` on each poll.

**Initial load:** On mount, ChatPanel fetches recent history to pre-populate messages (already implicit via existing load, but needs to be explicit if proactive messages are in the DB).

---

## Proactive Monitor Loop — Full Design

Location: `backend/app/main.py` (alongside `_snapshot_loop`)

```python
ALERT_THRESHOLD_PCT = 2.0
ALERT_COOLDOWN_SEC = 600  # 10 minutes per ticker

async def _proactive_monitor_loop(price_cache: PriceCache, baselines: dict[str, float]) -> None:
    """Monitor session moves; trigger AI commentary on >2% moves."""
    last_alerted: dict[str, float] = {}  # ticker → timestamp of last alert
    while True:
        await asyncio.sleep(3.0)
        try:
            now = asyncio.get_running_loop().time()
            prices = price_cache.get_all()
            for ticker, update in prices.items():
                baseline = baselines.get(ticker, update.price)
                if baseline == 0:
                    continue
                session_pct = (update.price - baseline) / baseline * 100
                if abs(session_pct) < ALERT_THRESHOLD_PCT:
                    continue
                last = last_alerted.get(ticker, 0.0)
                if now - last < ALERT_COOLDOWN_SEC:
                    continue
                last_alerted[ticker] = now
                # Fire LLM call (non-blocking via asyncio task)
                asyncio.create_task(
                    _generate_proactive_alert(ticker, session_pct, update.price, price_cache)
                )
        except Exception:
            logger.exception("Proactive monitor error")
```

The `_generate_proactive_alert` function:
- Builds a minimal prompt (no chat history needed)
- Calls `acompletion` with `reasoning_effort="low"` (fastest)
- Saves result to `chat_messages` via `_save_message()`
- In `LLM_MOCK=true` mode, skips the LLM call and inserts a canned message

---

## Frontend Changes

### ChatPanel.tsx Changes

1. **Add polling for new messages:**
   ```typescript
   // Poll every 5s for messages added externally (proactive alerts)
   useEffect(() => {
     const poll = async () => {
       const lastId = lastKnownIdRef.current;
       const newMsgs = await fetchChatMessages(lastId);
       if (newMsgs.length > 0) {
         setMessages(prev => [...prev, ...newMsgs.map(toLocalMsg)]);
         lastKnownIdRef.current = newMsgs[newMsgs.length - 1].id;
       }
     };
     const id = setInterval(poll, 5000);
     return () => clearInterval(id);
   }, []);
   ```

2. **Slash command expansion in `handleSend()`:**
   ```typescript
   const expandedMsg = expandSlashCommand(msg);
   // then: sendChat(expandedMsg)
   ```

3. **Slash command hint UI:** Conditional dropdown above input, shown when `input.startsWith("/")`.

4. **Proactive message badge:** Messages with `actions?.proactive === true` get a distinct visual treatment (e.g., an amber/accent dot or label "Market Alert").

### MarketSummaryBanner.tsx (new component)

- Fetches `GET /api/chat/market-summary` on mount
- Shows loading skeleton (animate-pulse) while fetching
- Renders a single-line text strip with amber accent color
- Sits between `<Header>` and the main three-column grid in `page.tsx`

### page.tsx Changes

- Import and mount `<MarketSummaryBanner />` between header and main layout div

### api.ts Changes

```typescript
export async function fetchMarketSummary(): Promise<{summary: string; generated_at: string}> { ... }
export async function fetchChatMessages(afterId?: string): Promise<ChatMessage[]> { ... }
```

### types.ts Changes

```typescript
export interface MarketSummary {
  summary: string;
  generated_at: string;
}
// ChatMessage already exists; add proactive flag to ChatActions:
export interface ChatActions {
  trades: TradeResult["trade"][];
  trade_errors: string[];
  watchlist_changes: { ticker: string; action: string }[];
  proactive?: boolean;  // new optional field
  ticker?: string;      // new optional field (for proactive alerts)
}
```

---

## Full Data Flow Summary

```
FEATURE 1: PROACTIVE ALERTS
═══════════════════════════
PriceCache ──3s poll──► _proactive_monitor_loop
                              │
                              │ session_pct > 2% + cooldown check
                              ▼
                    acompletion (Cerebras, ~1s)
                              │
                              ▼
                   _save_message("assistant", ..., actions={"proactive": True})
                              │
                   chat_messages SQLite table
                              │
                   ChatPanel polls every 5s
                   GET /api/chat/messages?after=<last_id>
                              │
                              ▼
                   ChatPanel.messages state ← new proactive bubble

FEATURE 2: MARKET SUMMARY
══════════════════════════
page.tsx mounts
      │ useEffect once
      ▼
GET /api/chat/market-summary
      │ price_cache.get_all() + session_baselines + portfolio
      ▼
acompletion (focused 1-sentence prompt)
      │
      ▼
MarketSummaryBanner renders text

FEATURE 3: SLASH COMMANDS
══════════════════════════
ChatPanel input: "/analyze"
      │ expandSlashCommand() in handleSend()
      ▼
"Analyze my portfolio in detail..."
      │
POST /api/chat (existing endpoint, richer context)
      │
LLM response (uses enriched system prompt)
      ▼
Normal chat bubble + action chips

FEATURE 4: RICHER CONTEXT
══════════════════════════
POST /api/chat (or proactive or market-summary)
      │ _portfolio_context(price_cache, session_baselines)
      ▼
Enriched system prompt includes:
- Position weights + concentration flags
- Session movers (top 3)
- P&L % per position
- Portfolio vs starting capital delta
```

---

## Files to Create / Modify

### New Backend Files
- `backend/app/routes/chat.py` — extend with: `GET /api/chat/messages`, `GET /api/chat/market-summary`, enhanced `_portfolio_context()`, proactive helpers

### New Frontend Files
- `frontend/components/MarketSummaryBanner.tsx` — slim AI summary card

### Modified Backend Files
- `backend/app/main.py` — add `_proactive_monitor_loop`, `app.state.session_baselines`, wire up new routes

### Modified Frontend Files
- `frontend/components/ChatPanel.tsx` — add polling, slash command expansion, hint UI, proactive badge
- `frontend/app/page.tsx` — mount `<MarketSummaryBanner />`
- `frontend/lib/api.ts` — add `fetchMarketSummary()`, `fetchChatMessages()`
- `frontend/lib/types.ts` — extend `ChatActions` with `proactive?`, `ticker?`; add `MarketSummary`

---

## API Contracts

### `GET /api/chat/messages`

Query params: `after` (optional string, message UUID)

Returns: Array of `ChatMessage` objects newer than the given ID.

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "assistant",
    "content": "TSLA just surged +3.1% this session...",
    "actions": { "proactive": true, "ticker": "TSLA", "trades": [], "trade_errors": [], "watchlist_changes": [] },
    "created_at": "2026-05-28T10:31:00Z"
  }
]
```

If `after` is omitted: returns the last 20 messages (for initial ChatPanel load from DB).

### `GET /api/chat/market-summary`

Returns:
```json
{
  "summary": "Markets mixed: TSLA +3.1%, NVDA +2.5%, JPM -2.4%. Your portfolio is +1.4% ($140). NVDA is your largest position at 41%.",
  "generated_at": "2026-05-28T10:30:00Z"
}
```

Error: `503` if price cache has no data yet (return `{"summary": "Market data loading...", "generated_at": "..."}` with 200 instead — never error on the UI).

---

## Risks and Gotchas

### Risk 1: `PriceUpdate.change_percent` is tick-to-tick, not session

**Issue:** The SSE `change_percent` field compares each tick to the previous tick — it's not a session % change.

**Fix:** Track `session_baselines` in `app.state` from startup. The proactive monitor uses `(current_price - baseline) / baseline * 100`. This is explicitly required — do not use `PriceUpdate.change_percent` for threshold detection.

### Risk 2: LLM calls from background task block the event loop

**Issue:** `acompletion` is async but still does I/O. If called synchronously in the monitor loop it will work fine (asyncio cooperative multitasking). However, scheduling many concurrent LLM calls via `asyncio.create_task` could pile up.

**Fix:** Max 1 in-flight proactive LLM call at a time. Use a semaphore: `_alert_semaphore = asyncio.Semaphore(1)`. Each `_generate_proactive_alert` acquires it. This prevents call pile-up when multiple tickers move simultaneously.

### Risk 3: Market summary card slows page load

**Issue:** `/api/chat/market-summary` makes an LLM call on every page load (~1-2 seconds). This delays the visible summary card.

**Fix:** The card shows a loading skeleton immediately (using CSS `animate-pulse`). The chart and watchlist load from SSE/cache in parallel — they are not blocked by the LLM call. The banner fills in after ~1-2 seconds. Acceptable UX.

**Alternative (not chosen):** Cache the summary for 60s server-side. Adds complexity. Skip for now.

### Risk 4: Proactive messages appear in ChatPanel mid-conversation

**Issue:** If the user is actively chatting, a proactive message injected by polling could disrupt the conversation flow.

**Fix:** Only inject proactive messages at the bottom of the chat list (which is the natural append behavior). The auto-scroll logic in ChatPanel's `useEffect` already scrolls to `bottomRef` on `messages` change — this is correct behavior, the new message scrolls into view.

**Additional consideration:** Don't poll while `loading === true` (user is waiting for an LLM response). Pause the polling interval during active requests to avoid race conditions on the messages list.

### Risk 5: `fetchChatMessages` ID ordering assumption

**Issue:** The `after=<id>` pattern assumes IDs are orderable by insertion time. The `chat_messages` table uses UUIDs for `id`.

**Fix:** Use `created_at` timestamp as the filter instead of ID:

```
GET /api/chat/messages?after_ts=<ISO timestamp>
```

The backend queries: `WHERE created_at > ? AND user_id = ? ORDER BY created_at ASC`. The frontend tracks `lastSeenTs` (ISO string of the last message's `created_at`). This is reliable and avoids UUID ordering issues.

### Risk 6: Slash command prompt expansion may confuse users

**Issue:** The user types `/analyze` but the LLM is called with a longer English string. The user message bubble in chat should show the original `/analyze` command (not the expanded form) to avoid confusion.

**Fix:** Store `msg` (original) as the user bubble content, but call `sendChat(expandedMsg)` (expanded). `_save_message("user", expandedMsg)` saves the expanded form to DB — acceptable since it's the AI's actual context.

**OR:** Show `/analyze` in the UI bubble but send the expansion to the LLM. The saved DB record uses the expansion. This is cleanest.

### Risk 7: Proactive loop on LLM_MOCK mode

**Issue:** If `LLM_MOCK=true`, the proactive monitor would never fire real LLM calls. Should it still inject canned messages?

**Fix:** Yes — in mock mode, inject a deterministic canned proactive message when threshold is crossed. This makes E2E tests for proactive alerts possible without OpenRouter.

---

## Validation Architecture

| Feature | Test approach |
|---------|--------------|
| Session baseline tracking | Unit test: after `start()`, `session_baselines` contains all tickers with non-zero prices |
| Proactive threshold | Unit test: simulate price moving from 100 to 103 (3%) → monitor detects and fires |
| Proactive cooldown | Unit test: fire alert for AAPL, immediately check again — should NOT fire second alert |
| Proactive message in DB | Unit test: after `_generate_proactive_alert()` resolves, `chat_messages` has a row with `actions` containing `proactive: true` |
| `/api/chat/messages` endpoint | Integration test: insert a proactive message, call endpoint, verify it's returned |
| `/api/chat/market-summary` endpoint | Integration test: call endpoint, verify response has `summary` string |
| Slash command expansion | Unit test `expandSlashCommand("/analyze")` returns the expected English prompt |
| Richer portfolio context | Unit test: `_portfolio_context()` with mock positions returns weight % and concentration flag |
| ChatPanel polling | E2E: in LLM_MOCK mode, trigger a proactive message (via test API call), verify it appears in chat within 8 seconds |
| MarketSummaryBanner | E2E: page load shows banner with non-empty summary text |
| `/analyze` slash command | E2E: type `/analyze`, verify chat responds with portfolio breakdown |
| No regression | All existing backend tests (`uv run --extra dev pytest tests/ -v`) still pass |

---

## RESEARCH COMPLETE
