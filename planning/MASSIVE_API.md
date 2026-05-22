# Massive API Reference (formerly Polygon.io)

Reference for the Massive (formerly Polygon.io) REST API as used in AI Trading Workstation. The Python package `massive` is a thin wrapper over the Polygon.io REST API; base URLs and endpoint paths are unchanged from Polygon.io.

---

## Authentication

- **Base URL**: `https://api.polygon.io`
- **Python package**: `massive` (`uv add massive`)
- **Min Python**: 3.9+
- **Auth (raw HTTP)**: Query parameter `?apiKey=YOUR_KEY`, or `Authorization: Bearer YOUR_KEY` header
- **Auth (Python client)**: Pass `api_key=` to `RESTClient`; it handles headers automatically

```python
from massive import RESTClient

# Explicit key
client = RESTClient(api_key="YOUR_MASSIVE_API_KEY")

# Or reads POLYGON_API_KEY / APCA_API_KEY from environment (Polygon convention)
# For this project we pass the key explicitly from MASSIVE_API_KEY env var
```

---

## Rate Limits

| Tier | Limit | Data freshness |
|------|-------|----------------|
| Free | 5 requests / minute | 15-minute delayed |
| Starter / above | Unlimited (stay under ~100 req/s) | Real-time |

**For this project (free tier):** poll once every 15 seconds. The SSE stream still emits cached prices at 500ms regardless of poll frequency.

---

## Endpoints Used in AI Trading Workstation

### 1. Snapshot — Multiple Tickers (primary polling endpoint)

Fetches current price data for up to 250 tickers in **one API call**. This is the core endpoint for our poller.

**REST:** `GET /v2/snapshot/locale/us/markets/stocks/tickers`

**Query parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tickers` | string | Comma-separated ticker symbols: `AAPL,GOOGL,MSFT` |
| `include_otc` | bool | Include OTC securities (default: false) |
| `apiKey` | string | API key (when using raw HTTP) |

**Python client:**
```python
from massive import RESTClient
from massive.rest.models import SnapshotMarketType

client = RESTClient(api_key="YOUR_KEY")

snapshots = client.get_snapshot_all(
    market_type=SnapshotMarketType.STOCKS,
    tickers=["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"],
)

for snap in snapshots:
    price = snap.last_trade.price if snap.last_trade else None
    prev_close = snap.prev_day.close if snap.prev_day else None
    ts_ms = snap.last_trade.timestamp if snap.last_trade else None
    ts_sec = ts_ms / 1000.0 if ts_ms else None

    print(f"{snap.ticker}: ${price}  prev_close={prev_close}  ts={ts_sec}")
```

**Response shape (per ticker):**
```json
{
  "ticker": "AAPL",
  "last_trade": {
    "price": 191.45,
    "size": 100,
    "exchange": "XNAS",
    "timestamp": 1716393600000
  },
  "last_quote": {
    "bid_price": 191.44,
    "ask_price": 191.46,
    "bid_size": 200,
    "ask_size": 300,
    "timestamp": 1716393600100
  },
  "day": {
    "open": 189.50,
    "high": 192.10,
    "low": 188.90,
    "close": 191.45,
    "volume": 52340000,
    "volume_weighted_average_price": 190.75,
    "previous_close": 188.60,
    "change": 2.85,
    "change_percent": 1.51
  },
  "prev_day": {
    "open": 187.20,
    "high": 189.80,
    "low": 186.50,
    "close": 188.60,
    "volume": 48100000,
    "volume_weighted_average_price": 188.10
  },
  "min": {
    "open": 191.30,
    "high": 191.50,
    "low": 191.20,
    "close": 191.45,
    "volume": 12000
  }
}
```

**Fields we extract:**
| Field | Use |
|-------|-----|
| `last_trade.price` | Current price (for trading and SSE stream) |
| `last_trade.timestamp` | Unix ms → divide by 1000 for Unix seconds |
| `prev_day.close` | Fallback price if `last_trade` is absent (market closed) |
| `day.previous_close` | Session baseline for computing daily change % |

**Fallback when `last_trade` is absent** (market closed or illiquid):
```python
price = snap.last_trade.price if snap.last_trade else None
if price is None or price <= 0:
    prev_day = getattr(snap, "prev_day", None)
    price = getattr(prev_day, "close", None) if prev_day else None
```

---

### 2. Single Ticker Snapshot

Used for a detailed view on one ticker (e.g., user clicks a ticker for the chart panel).

**REST:** `GET /v2/snapshot/locale/us/markets/stocks/tickers/{ticker}`

**Python client:**
```python
snap = client.get_snapshot_ticker(
    market_type=SnapshotMarketType.STOCKS,
    ticker="AAPL",
)

print(f"Price:     ${snap.last_trade.price}")
print(f"Bid/Ask:   ${snap.last_quote.bid_price} / ${snap.last_quote.ask_price}")
print(f"Day range: ${snap.day.low} – ${snap.day.high}")
print(f"Day %:     {snap.day.change_percent:.2f}%")
```

---

### 3. Previous Close / Previous Day Bar

OHLCV data for the previous trading session. Useful for seeding realistic starting prices and computing day-over-day change.

**REST:** `GET /v2/aggs/ticker/{ticker}/prev`

**Python client:**
```python
prev = client.get_previous_close_agg(ticker="AAPL")

for bar in prev:
    print(f"Close: ${bar.close}")
    print(f"OHLC:  O={bar.open} H={bar.high} L={bar.low} C={bar.close}")
    print(f"Vol:   {bar.volume:,}")
    # bar.timestamp is Unix milliseconds
```

**Response (raw JSON):**
```json
{
  "ticker": "AAPL",
  "results": [
    {
      "o": 187.20,
      "h": 189.80,
      "l": 186.50,
      "c": 188.60,
      "v": 48100000,
      "vw": 188.10,
      "t": 1716307200000
    }
  ]
}
```

---

### 4. Historical Daily Bars (Aggregates)

Not required for live polling, but useful for seeding the chart panel with historical context.

**REST:** `GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}`

**Python client:**
```python
bars = list(client.list_aggs(
    ticker="AAPL",
    multiplier=1,
    timespan="day",
    from_="2024-01-01",
    to="2024-01-31",
    adjusted=True,
    limit=50000,
))

for bar in bars:
    print(f"t={bar.timestamp}  O={bar.open} H={bar.high} L={bar.low} C={bar.close} V={bar.volume}")
```

---

### 5. Last Trade / Last Quote

Individual endpoints for the single most-recent trade or NBBO quote. Rarely needed since the snapshot endpoint includes this data.

```python
# Most recent trade
trade = client.get_last_trade(ticker="AAPL")
print(f"Last trade: ${trade.price} × {trade.size}")

# Most recent NBBO quote
quote = client.get_last_quote(ticker="AAPL")
print(f"Bid: ${quote.bid} × {quote.bid_size}")
print(f"Ask: ${quote.ask} × {quote.ask_size}")
```

---

## How AI Trading Workstation Uses the API

The `MassiveDataSource` runs as a background asyncio task:

1. Calls `get_snapshot_all()` with the current watchlist — **one API call for all tickers**
2. Extracts `last_trade.price` (falling back to `prev_day.close` if absent)
3. Converts the millisecond timestamp to seconds
4. Writes to the shared `PriceCache`
5. Sleeps for `poll_interval` (default 15s on free tier), then repeats

```python
import asyncio
from massive import RESTClient
from massive.rest.models import SnapshotMarketType
from app.market.cache import PriceCache

async def poll_loop(api_key: str, tickers: list[str], cache: PriceCache, interval: float = 15.0):
    client = RESTClient(api_key=api_key)

    while True:
        if tickers:
            # Synchronous client → run in thread pool to avoid blocking event loop
            snapshots = await asyncio.to_thread(
                client.get_snapshot_all,
                market_type=SnapshotMarketType.STOCKS,
                tickers=tickers,
            )
            for snap in snapshots:
                price = snap.last_trade.price if snap.last_trade else None
                if price is None or price <= 0:
                    prev = getattr(snap, "prev_day", None)
                    price = getattr(prev, "close", None) if prev else None
                if price and price > 0:
                    ts = snap.last_trade.timestamp / 1000.0 if snap.last_trade else None
                    cache.update(ticker=snap.ticker, price=price, timestamp=ts)

        await asyncio.sleep(interval)
```

The SSE stream reads from `PriceCache` every 500ms, so clients receive updates at 500ms cadence even though the Massive API is polled only every 15s. The cached price is re-emitted between polls.

---

## Error Handling

| HTTP status | Cause | Action |
|-------------|-------|--------|
| 401 | Invalid API key | Log and halt; no retry (key won't fix itself) |
| 403 | Plan doesn't cover endpoint | Log and halt |
| 429 | Rate limit exceeded | Log and sleep; the loop retries on next interval |
| 5xx | Server error | Log and continue; the `massive` client retries up to 3× by default |

```python
try:
    snapshots = await asyncio.to_thread(client.get_snapshot_all, ...)
except Exception as e:
    logger.error("Massive poll failed: %s", e)
    # Don't re-raise — loop continues on next interval
```

---

## Notes

- The snapshot endpoint returns all requested tickers in **one call** — essential for staying under the free-tier 5 req/min limit
- Timestamps from the API are **Unix milliseconds**; the Python client also exposes them in ms
- During market-closed hours, `last_trade.price` is the last traded price (may include after-hours)
- The `day` object resets at market open; pre-market values may reflect the previous session
- Free-tier data has a 15-minute delay — prices shown in the UI will lag real-time by up to 15 minutes
- The `massive` Python client is synchronous; always call it via `asyncio.to_thread()` from async code
