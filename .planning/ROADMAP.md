# Roadmap: AI Trading Workstation — Finance Ally

**Generated:** 2026-05-26 | **Updated:** 2026-05-29
**Total Phases:** 12 | **Total Requirements:** 47 | **Coverage:** 100% ✓

---

## Summary

| # | Phase | Status | Requirements | Success Criteria |
|---|-------|--------|--------------|-----------------|
| 1 | Market Data & Streaming | ✅ Complete | MKT-01–07 | 4 |
| 2 | Portfolio, Trading & Backend | ✅ Complete | PORT-01–08, WL-01–05, BE-01–04 | 5 |
| 3 | AI Chat Integration | ✅ Complete | CHAT-01–08 | 4 |
| 4 | Frontend Dashboard | ✅ Complete | UI-01–08 | 5 |
| 5 | Docker & Deployment | ✅ Complete | DEPLOY-01–05 | 3 |
| 6 | Testing | ✅ Complete | TEST-01–05 | 3 |
| 7 | Bug Fixes & Polish | ✅ Complete | BUG-01, BUG-02 | 4 |
| 8 | Trade History & Portfolio Analytics | ✅ Complete | — | 4 |
| 9 | Technical Indicators & Chart Upgrades | ✅ Complete | — | 4 |
| 10 | AI Intelligence Upgrade | ✅ Complete | — | 4 |
| 11 | Price Alerts & Notifications | ✅ Complete | — | 3 |
| 12 | Settings & User Control | 📋 Planned | — | 3 |

---

### Phase 1: Market Data & Streaming

**Goal:** Prices flow live from backend to browser. The SSE connection is stable, prices flash on change, and both the simulator and Massive API implement the same interface.

**Status:** ✅ Complete

**Requirements:** MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, MKT-06, MKT-07

**Success Criteria:**
1. Browser shows price updates appearing within 1 second of SSE connect
2. Price cells briefly flash green or red on each update, then return to neutral
3. Disconnecting the SSE and reconnecting recovers automatically without page reload
4. Switching `MASSIVE_API_KEY` env var enables Polygon.io mode without code changes

---

### Phase 2: Portfolio, Trading & Backend

**Goal:** Users can trade with fake cash, their positions are tracked accurately, and the full REST API surface (portfolio, watchlist, health) is operational with a SQLite database initialized from scratch on first run.

**Status:** ✅ Complete

**Requirements:** PORT-01, PORT-02, PORT-03, PORT-04, PORT-05, PORT-06, PORT-07, PORT-08, WL-01, WL-02, WL-03, WL-04, WL-05, BE-01, BE-02, BE-03, BE-04

**Success Criteria:**
1. Fresh Docker volume start shows $10,000 cash and 10-ticker watchlist — no manual setup
2. Buying 5 shares reduces cash by `5 × price`, adds position row with correct avg cost
3. Selling all shares of a position removes it and returns cash correctly
4. Buy rejected with error when cash insufficient; sell rejected when shares insufficient
5. Portfolio snapshot recorded after each trade; P&L chart shows updated line

---

### Phase 3: AI Chat Integration

**Goal:** The AI assistant can analyze the portfolio in natural language, auto-execute trades, and manage the watchlist — all without a confirmation dialog.

**Status:** ✅ Complete

**Requirements:** CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, CHAT-08

**Success Criteria:**
1. Asking "what's in my portfolio?" returns accurate cash/holdings/positions summary
2. Saying "buy 2 AAPL" causes a trade to execute and appear as a confirmation chip
3. Saying "add TSLA to my watchlist" adds it and confirms inline
4. `LLM_MOCK=true` returns deterministic response without calling OpenRouter

---

### Phase 4: Frontend Dashboard

**Goal:** The full Bloomberg-terminal-style dashboard renders correctly — watchlist, chart, portfolio panel, trade bar, AI chat — in a data-dense dark layout with all interactive flows working.

**Status:** ✅ Complete

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08

**Success Criteria:**
1. All 7 UI zones render on first load: Header, Watchlist, Chart, Tabs (Positions/Heatmap/P&L), TradeBar, ChatPanel, connection dot
2. Clicking a watchlist ticker updates the main chart to that ticker
3. Portfolio heatmap tiles appear sized by weight and colored green/red by P&L
4. Chat panel collapses and expands via the toggle button without layout breaking
5. Trade bar inputs and BUY/SELL buttons fit entirely within the watchlist column width

---

### Phase 5: Docker & Deployment

**Goal:** The entire app runs from a single `docker run` command (or provided script). The multi-stage build produces a minimal image that serves both the API and static frontend on port 8000.

**Status:** ✅ Complete

**Requirements:** DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05

**Success Criteria:**
1. `.\scripts\start_windows.ps1 -Build` builds image and opens app at localhost:8000
2. Stopping and restarting container preserves portfolio data (SQLite volume mount)
3. `.env.example` documents all variables; app runs without `MASSIVE_API_KEY` or `LLM_MOCK`

---

### Phase 6: Testing

**Goal:** The backend has comprehensive unit test coverage and the full user journey is validated by E2E tests in both mock and live modes.

**Status:** ✅ Complete

**Requirements:** TEST-01, TEST-02, TEST-03, TEST-04, TEST-05

**Success Criteria:**
1. `uv run --extra dev pytest tests/ -v` passes all 128 tests with no failures
2. `npx playwright test` passes all 8 E2E scenarios against a running app
3. `LLM_MOCK=true` E2E tests run without an OpenRouter API key

---

### Phase 7: Bug Fixes & Polish

**Goal:** The two known UI/backend bugs are fixed, committed, and verified. The application is in a clean, demo-ready state with all changes pushed.

**Status:** ✅ Complete

**Requirements:** BUG-01, BUG-02

**Success Criteria:**
1. TradeBar shows two rows (inputs on top, buttons on bottom) — buttons never overflow the watchlist column at any viewport width
2. AI chat successfully executes trades for tickers added to the watchlist in the same response (no "No price available" errors for newly-added tickers)
3. Both fixes committed to `feat/backend-api` branch and PR created
4. Backend unit tests still pass after chat.py changes (`uv run --extra dev pytest tests/ -v`)

---

---

### Phase 8: Trade History & Portfolio Analytics

**Goal:** The Positions panel becomes a full analytics dashboard. Users can see every trade they ever executed, measure actual performance, and export data.

**Status:** ✅ Complete (2026-05-28)

**Depends on:** Phase 7

**Scope:**
- Trade log tab in the portfolio panel — full history table (date, ticker, side, qty, price, P&L at close)
- Portfolio analytics cards: total return %, best performer, worst performer, win rate
- Realized vs unrealized P&L breakdown
- Export trades to CSV download

**Success Criteria:**
1. Trade log tab shows all executed trades, newest first, with correct calculated P&L
2. Analytics cards update live as prices move (unrealized) or trades execute (realized)
3. Win rate correctly counts closed positions with positive P&L vs total closed
4. CSV export downloads a valid file with all trade history

---

### Phase 9: Technical Indicators & Chart Upgrades

**Goal:** The price chart gains toggleable technical overlays, making it look and feel like a professional charting terminal.

**Status:** ✅ Complete (2026-05-28)

**Depends on:** Phase 8

**Scope:**
- Moving average overlays on the price chart: MA20 and MA50 as toggleable lines
- RSI (14) sub-panel below the main chart with overbought/oversold zones
- Volume bars rendered at the bottom of the price chart
- Indicator toggle buttons in the chart header

**Success Criteria:**
1. MA20 and MA50 lines render correctly on the price chart and toggle on/off
2. RSI panel appears below the chart when enabled, with 70/30 reference lines
3. Volume bars scale correctly relative to each other
4. All indicators update in real time as new prices arrive via SSE

---

### Phase 10: AI Intelligence Upgrade

**Goal:** The AI assistant becomes proactive and context-aware — it notices market moves, surfaces insights unprompted, and has a richer understanding of the user's portfolio risk.

**Status:** ✅ Complete (2026-05-28)

**Depends on:** Phase 9

**Scope:**
- Proactive commentary: AI posts a brief market note when a ticker moves >2% in a session
- Market summary card shown on page load (generated by AI from current prices + portfolio)
- Richer portfolio context in the system prompt: risk concentration, largest mover, unrealized P&L by position
- Slash command shortcuts in chat: `/analyze`, `/rebalance`, `/risk`

**Success Criteria:**
1. Large price move (>2%) triggers an AI commentary bubble in the chat panel within 5 seconds
2. Page load shows a market summary card generated from live prices
3. `/analyze` returns a structured portfolio breakdown with risk commentary
4. `/rebalance` suggests specific trades with reasoning based on current weights

---

### Phase 11: Price Alerts & Notifications

**Goal:** Users and the AI can set price level triggers. When a ticker crosses the threshold, a visible alert fires and the AI references it in chat context.

**Status:** ✅ Complete (2026-05-29)

**Depends on:** Phase 10

**Scope:**
- Alert creation UI in the watchlist (right-click or hover action → "Set alert at $X")
- Backend alert registry checked on each SSE price tick
- Toast notification (bottom-right) when an alert fires
- AI chat receives fired alerts as context so it can comment on them

**Success Criteria:**
1. User sets an alert at a given price level; alert fires when SSE price crosses threshold
2. Toast notification appears within 1 second of threshold crossing
3. AI chat references the fired alert in its next message without being explicitly told
4. Alerts persist across page refreshes (stored in SQLite)

---

### Phase 12: Settings & User Control

**Goal:** Users have meaningful control over their environment — they can reset their portfolio, adjust starting capital, and persist their layout preferences.

**Status:** 📋 Planned

**Depends on:** Phase 11

**Scope:**
- Portfolio reset button (confirm dialog → wipes trades/positions, restores cash to configured starting amount)
- Configurable starting capital (default $10k, settable via settings panel)
- Layout preference persistence: chat panel open/closed, active portfolio tab, selected ticker
- Dark/light theme toggle (light theme for daytime use)

**Success Criteria:**
1. Portfolio reset wipes all positions and trades, restores cash, and shows $0 P&L
2. Starting capital setting persists across container restarts (stored in DB)
3. Selected ticker, portfolio tab, and chat state are restored on page reload
4. Light theme renders all components correctly with no illegible text

---

## Requirement Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MKT-01 | Phase 1 | ✅ Complete |
| MKT-02 | Phase 1 | ✅ Complete |
| MKT-03 | Phase 1 | ✅ Complete |
| MKT-04 | Phase 1 | ✅ Complete |
| MKT-05 | Phase 1 | ✅ Complete |
| MKT-06 | Phase 1 | ✅ Complete |
| MKT-07 | Phase 1 | ✅ Complete |
| PORT-01 | Phase 2 | ✅ Complete |
| PORT-02 | Phase 2 | ✅ Complete |
| PORT-03 | Phase 2 | ✅ Complete |
| PORT-04 | Phase 2 | ✅ Complete |
| PORT-05 | Phase 2 | ✅ Complete |
| PORT-06 | Phase 2 | ✅ Complete |
| PORT-07 | Phase 2 | ✅ Complete |
| PORT-08 | Phase 2 | ✅ Complete |
| WL-01 | Phase 2 | ✅ Complete |
| WL-02 | Phase 2 | ✅ Complete |
| WL-03 | Phase 2 | ✅ Complete |
| WL-04 | Phase 2 | ✅ Complete |
| WL-05 | Phase 2 | ✅ Complete |
| BE-01 | Phase 2 | ✅ Complete |
| BE-02 | Phase 2 | ✅ Complete |
| BE-03 | Phase 2 | ✅ Complete |
| BE-04 | Phase 2 | ✅ Complete |
| CHAT-01 | Phase 3 | ✅ Complete |
| CHAT-02 | Phase 3 | ✅ Complete |
| CHAT-03 | Phase 3 | ✅ Complete |
| CHAT-04 | Phase 3 | ✅ Complete |
| CHAT-05 | Phase 3 | ✅ Complete |
| CHAT-06 | Phase 3 | ✅ Complete |
| CHAT-07 | Phase 3 | ✅ Complete |
| CHAT-08 | Phase 3 | ✅ Complete |
| UI-01 | Phase 4 | ✅ Complete |
| UI-02 | Phase 4 | ✅ Complete |
| UI-03 | Phase 4 | ✅ Complete |
| UI-04 | Phase 4 | ✅ Complete |
| UI-05 | Phase 4 | ✅ Complete |
| UI-06 | Phase 4 | ✅ Complete |
| UI-07 | Phase 4 | ✅ Complete |
| UI-08 | Phase 4 | ✅ Complete |
| DEPLOY-01 | Phase 5 | ✅ Complete |
| DEPLOY-02 | Phase 5 | ✅ Complete |
| DEPLOY-03 | Phase 5 | ✅ Complete |
| DEPLOY-04 | Phase 5 | ✅ Complete |
| DEPLOY-05 | Phase 5 | ✅ Complete |
| TEST-01 | Phase 6 | ✅ Complete |
| TEST-02 | Phase 6 | ✅ Complete |
| TEST-03 | Phase 6 | ✅ Complete |
| TEST-04 | Phase 6 | ✅ Complete |
| TEST-05 | Phase 6 | ✅ Complete |
| BUG-01 | Phase 7 | ✅ Complete |
| BUG-02 | Phase 7 | ✅ Complete |

**Coverage:**
- v1 requirements: 47 total (45 requirements + 2 bug fixes)
- Mapped to phases: 47
- Unmapped: 0 ✓

---
*Roadmap created: 2026-05-26*
*Last updated: 2026-05-26 after initialization*
