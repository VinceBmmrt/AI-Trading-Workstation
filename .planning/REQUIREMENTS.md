# Requirements: AI Trading Workstation — Finance Ally

**Defined:** 2026-05-26
**Core Value:** A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.

## v1 Requirements

### Market Data

- [x] **MKT-01**: Prices stream live to the browser via SSE, pushing updates at 500ms cadence
- [x] **MKT-02**: Prices flash green on uptick, red on downtick with CSS transition fading ~500ms
- [x] **MKT-03**: GBM simulator generates realistic prices with per-ticker drift/volatility and correlated moves
- [x] **MKT-04**: Simulator starts from realistic seed prices (AAPL ~$190, GOOGL ~$175, etc.)
- [x] **MKT-05**: Massive (Polygon.io) REST API integration, same interface as simulator
- [x] **MKT-06**: Thread-safe shared price cache used by SSE stream, portfolio, and chat
- [x] **MKT-07**: Client auto-reconnects on SSE disconnect (EventSource built-in retry)

### Portfolio & Trading

- [x] **PORT-01**: User starts with $10,000 virtual cash, no other funding mechanism
- [x] **PORT-02**: User can execute market orders (buy/sell) with instant fill at current price, no fees
- [x] **PORT-03**: Portfolio shows all positions: ticker, quantity, avg cost, current price, unrealized P&L, % change
- [x] **PORT-04**: Portfolio heatmap (treemap) sizes positions by portfolio weight, colors by P&L
- [x] **PORT-05**: P&L chart shows total portfolio value over time from snapshots
- [x] **PORT-06**: Portfolio snapshots recorded every 30 seconds and after each trade
- [x] **PORT-07**: Trade rejected with error when user lacks cash (buy) or shares (sell)
- [x] **PORT-08**: Fractional shares supported

### Watchlist

- [x] **WL-01**: Default 10-ticker watchlist seeded on first run (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX)
- [x] **WL-02**: User can add a ticker to watchlist manually
- [x] **WL-03**: User can remove a ticker from watchlist manually
- [x] **WL-04**: Watchlist shows ticker, current price (live), session change %, sparkline chart
- [x] **WL-05**: Clicking a ticker in watchlist selects it for the main chart

### AI Chat

- [x] **CHAT-01**: User can send natural language messages to AI assistant
- [x] **CHAT-02**: AI responds with portfolio analysis and trade suggestions
- [x] **CHAT-03**: AI auto-executes trades specified in structured response without confirmation dialog
- [x] **CHAT-04**: AI can add/remove watchlist tickers via structured response
- [x] **CHAT-05**: Executed trades and watchlist changes shown inline as confirmations in chat
- [x] **CHAT-06**: Trade failures shown as inline error chips with reason
- [x] **CHAT-07**: Chat loads last 10 messages (5 user + 5 assistant turns) as context window
- [x] **CHAT-08**: LLM mock mode (LLM_MOCK=true) returns deterministic responses for testing

### Frontend UI

- [x] **UI-01**: Dark terminal aesthetic — backgrounds ~#0d1117, muted borders, data-dense layout
- [x] **UI-02**: Header shows portfolio total value (live), connection status indicator, cash balance
- [x] **UI-03**: Watchlist panel in left column with sparklines and live price updates
- [x] **UI-04**: Main chart area shows selected ticker price history
- [x] **UI-05**: Portfolio panel with tabs: Positions, Heatmap, P&L — below main chart
- [x] **UI-06**: Trade bar allows ticker + quantity input with BUY/SELL buttons, fits within column width
- [x] **UI-07**: AI chat panel is collapsible right sidebar
- [x] **UI-08**: Connection status dot (green/yellow/red) visible in header

### Backend & Database

- [x] **BE-01**: SQLite database initialized on startup via FastAPI lifespan event (tables + seed data)
- [x] **BE-02**: All API routes implemented: /api/stream/prices, /api/portfolio, /api/portfolio/trade, /api/portfolio/history, /api/watchlist, /api/chat, /api/health
- [x] **BE-03**: Database schema includes: users_profile, watchlist, positions, trades, portfolio_snapshots, chat_messages
- [x] **BE-04**: user_id column on all tables defaults to "default" for single-user support

### Deployment

- [x] **DEPLOY-01**: Multi-stage Dockerfile (Node → Python) produces single container image
- [x] **DEPLOY-02**: Container serves frontend and API on single port 8000
- [x] **DEPLOY-03**: SQLite database persists via Docker named volume
- [x] **DEPLOY-04**: Start/stop scripts for Windows (PowerShell) and macOS/Linux (bash)
- [x] **DEPLOY-05**: `.env.example` documents all environment variables

### Testing

- [x] **TEST-01**: Backend unit tests cover market data simulator, GBM math, Massive API parsing
- [x] **TEST-02**: Backend unit tests cover portfolio trade execution, P&L calculations, edge cases
- [x] **TEST-03**: Backend unit tests cover LLM structured output parsing and error handling
- [x] **TEST-04**: Backend unit tests cover API routes (status codes, response shapes)
- [x] **TEST-05**: E2E Playwright tests cover: watchlist streaming, add/remove ticker, buy/sell flow, portfolio display, AI chat (mocked)

### Bug Fixes (Active)

- [ ] **BUG-01**: TradeBar BUY/SELL buttons overflow watchlist column — layout refactored to two rows
- [ ] **BUG-02**: AI chat fails when LLM suggests trading ticker not yet in price cache — watchlist changes now execute before trades with 600ms yield

## v2 Requirements

### Enhanced Market Data

- **MKT-V2-01**: WebSocket streaming (lower latency than SSE for high-frequency data)
- **MKT-V2-02**: Historical OHLCV data for candlestick charts
- **MKT-V2-03**: Real-time order book depth visualization

### Multi-User

- **USER-V2-01**: User accounts with authentication
- **USER-V2-02**: Separate portfolios per user
- **USER-V2-03**: Leaderboard of simulated portfolio performance

### Enhanced AI

- **AI-V2-01**: Streaming LLM responses (token-by-token)
- **AI-V2-02**: AI can set price alerts
- **AI-V2-03**: AI memory across sessions

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication | Single-user by design; `user_id="default"` hardcoded — no auth needed |
| Real money / real brokerage | Simulation only — legal and compliance complexity out of scope |
| Limit orders / stop-loss | Eliminates order book complexity; market orders sufficient for the course demo |
| Multi-container Docker Compose (production) | One container, one command — student simplicity is the constraint |
| Cloud deployment (Terraform/App Runner) | Stretch goal, not required for course delivery |
| Mobile-first / responsive design | Desktop-first terminal; tablet functional but not optimized |
| Paid Polygon.io tiers | Free tier (15s poll) only; paid-tier specifics not documented |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MKT-01 through MKT-07 | Phase 1 | Complete |
| PORT-01 through PORT-08 | Phase 2 | Complete |
| WL-01 through WL-05 | Phase 2 | Complete |
| BE-01 through BE-04 | Phase 2 | Complete |
| CHAT-01 through CHAT-08 | Phase 3 | Complete |
| UI-01 through UI-08 | Phase 4 | Complete |
| DEPLOY-01 through DEPLOY-05 | Phase 5 | Complete |
| TEST-01 through TEST-05 | Phase 6 | Complete |
| BUG-01, BUG-02 | Phase 7 | In Progress |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 47
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-26*
*Last updated: 2026-05-26 after initial definition*
