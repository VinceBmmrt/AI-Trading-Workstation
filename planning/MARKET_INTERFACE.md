# Market Data Interface Design

Unified Python interface for market data in AI Trading Workstation. Two implementations — `SimulatorDataSource` and `MassiveDataSource` — sit behind one abstract interface. All downstream code (SSE streaming, portfolio valuation, trade execution) is source-agnostic and reads only from `PriceCache`.

---

## Architecture Overview

```
MarketDataSource (ABC)
├── SimulatorDataSource  →  GBM price simulation (default; no API key needed)
└── MassiveDataSource    →  Polygon.io REST poller (when MASSIVE_API_KEY is set)
        │
        ▼  writes every update
   PriceCache (thread-safe, in-memory)
        │
        ├──→ SSE stream endpoint (/api/stream/prices)   reads every 500ms
        ├──→ Portfolio valuation                        reads on demand
        └──→ Trade execution                            reads on demand
```

The data source is selected at startup by `create_market_data_source()`. Nothing downstream knows or cares which implementation is running.

---

## Core Data Model

```python
# backend/app/market/models.py

from dataclasses import dataclass, field
import time

@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Immutable snapshot of a single ticker's price at a point in time."""

    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)  # Unix seconds

    @property
    def change(self) -> float:
        """Absolute change from previous update."""
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        """Percentage change from previous update."""
        if self.previous_price == 0:
            return 0.0
        return round((self.price - self.previous_price) / self.previous_price * 100, 4)

    @property
    def direction(self) -> str:
        """'up', 'down', or 'flat'."""
        if self.price > self.previous_price:
            return "up"
        elif self.price < self.previous_price:
            return "down"
        return "flat"

    def to_dict(self) -> dict:
        """Serialize for JSON / SSE transmission."""
        return {
            "ticker": self.ticker,
            "price": self.price,
            "previous_price": self.previous_price,
            "timestamp": self.timestamp,
            "change": self.change,
            "change_percent": self.change_percent,
            "direction": self.direction,
        }
```

`PriceUpdate` is frozen (immutable). `change`, `change_percent`, and `direction` are computed properties — no state to go stale.

---

## Abstract Interface

```python
# backend/app/market/interface.py

from abc import ABC, abstractmethod

class MarketDataSource(ABC):
    """Contract for market data providers.

    Implementations push updates into PriceCache on their own schedule.
    Downstream code never calls the data source directly for prices.

    Lifecycle:
        source = create_market_data_source(cache)
        await source.start(["AAPL", "GOOGL", ...])
        await source.add_ticker("TSLA")
        await source.remove_ticker("GOOGL")
        await source.stop()
    """

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """Begin producing price updates. Starts a background task.
        Call exactly once. Calling start() twice is undefined behavior.
        """

    @abstractmethod
    async def stop(self) -> None:
        """Stop the background task and release resources.
        Safe to call multiple times.
        """

    @abstractmethod
    async def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the active set. No-op if already present.
        Takes effect on the next update cycle.
        """

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker and evict it from PriceCache. No-op if absent."""

    @abstractmethod
    def get_tickers(self) -> list[str]:
        """Return the currently tracked tickers."""
```

---

## Price Cache

The single source of truth for all downstream price reads.

```python
# backend/app/market/cache.py

from threading import Lock
from .models import PriceUpdate
import time

class PriceCache:
    """Thread-safe in-memory cache of the latest price per ticker.

    Writers: one MarketDataSource at a time.
    Readers: SSE endpoint, portfolio valuation, trade execution (concurrent).
    """

    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._lock = Lock()
        self._version: int = 0  # Monotonically increments on every update

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        """Record a new price. Returns the created PriceUpdate.
        First update for a ticker: previous_price == price, direction='flat'.
        """
        with self._lock:
            ts = timestamp or time.time()
            prev = self._prices.get(ticker)
            previous_price = prev.price if prev else price
            update = PriceUpdate(
                ticker=ticker,
                price=round(price, 2),
                previous_price=round(previous_price, 2),
                timestamp=ts,
            )
            self._prices[ticker] = update
            self._version += 1
            return update

    def get(self, ticker: str) -> PriceUpdate | None:
        """Latest PriceUpdate for a ticker, or None."""
        with self._lock:
            return self._prices.get(ticker)

    def get_price(self, ticker: str) -> float | None:
        """Convenience: just the price float, or None."""
        update = self.get(ticker)
        return update.price if update else None

    def get_all(self) -> dict[str, PriceUpdate]:
        """Snapshot of all current prices (shallow copy)."""
        with self._lock:
            return dict(self._prices)

    def remove(self, ticker: str) -> None:
        """Evict a ticker (called when removed from watchlist)."""
        with self._lock:
            self._prices.pop(ticker, None)

    @property
    def version(self) -> int:
        """Monotonic counter; increments on every update.
        SSE endpoint uses this for change detection (poll until version changes).
        """
        with self._lock:
            return self._version
```

**Key design notes:**
- `version` lets the SSE streamer skip unchanged frames without comparing all prices
- The lock is a standard `threading.Lock`; asyncio tasks that call cache methods from a thread pool are safe
- `update()` computes `previous_price` from the last stored value, so direction tracking is automatic

---

## Factory Function

```python
# backend/app/market/factory.py

import os
import logging
from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """Select the data source based on MASSIVE_API_KEY environment variable.

    Returns an unstarted source. Caller must await source.start(tickers).
    """
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()

    if api_key:
        logger.info("Market data source: Massive API (real data)")
        from .massive_client import MassiveDataSource
        return MassiveDataSource(api_key=api_key, price_cache=price_cache)
    else:
        logger.info("Market data source: GBM Simulator")
        from .simulator import SimulatorDataSource
        return SimulatorDataSource(price_cache=price_cache)
```

---

## MassiveDataSource Implementation

Polls `GET /v2/snapshot/locale/us/markets/stocks/tickers` on an interval and writes to `PriceCache`.

```python
# backend/app/market/massive_client.py

import asyncio
import logging
from massive import RESTClient
from massive.rest.models import SnapshotMarketType
from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

class MassiveDataSource(MarketDataSource):
    """Polls the Massive (Polygon.io) REST snapshot endpoint.

    One API call per poll fetches all watched tickers.
    Free tier: poll_interval=15.0s (5 req/min limit).
    """

    def __init__(self, api_key: str, price_cache: PriceCache, poll_interval: float = 15.0) -> None:
        self._api_key = api_key
        self._cache = price_cache
        self._interval = poll_interval
        self._tickers: list[str] = []
        self._task: asyncio.Task | None = None
        self._client: RESTClient | None = None

    async def start(self, tickers: list[str]) -> None:
        self._client = RESTClient(api_key=self._api_key)
        self._tickers = list(tickers)
        await self._poll_once()  # Immediate first poll so cache has data on startup
        self._task = asyncio.create_task(self._poll_loop(), name="massive-poller")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        self._client = None

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        if ticker not in self._tickers:
            self._tickers.append(ticker)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        self._tickers = [t for t in self._tickers if t != ticker]
        self._cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self._interval)
            await self._poll_once()

    async def _poll_once(self) -> None:
        if not self._tickers or not self._client:
            return
        try:
            # RESTClient is synchronous; run in thread to avoid blocking event loop
            snapshots = await asyncio.to_thread(
                self._client.get_snapshot_all,
                market_type=SnapshotMarketType.STOCKS,
                tickers=self._tickers,
            )
            for snap in snapshots:
                price = snap.last_trade.price if snap.last_trade else None
                if price is None or price <= 0:
                    prev = getattr(snap, "prev_day", None)
                    price = getattr(prev, "close", None) if prev else None
                if price and price > 0:
                    ts = snap.last_trade.timestamp / 1000.0 if snap.last_trade else None
                    self._cache.update(ticker=snap.ticker, price=price, timestamp=ts)
        except Exception as e:
            logger.error("Massive poll failed: %s", e)
            # Don't re-raise — loop retries on next interval
```

---

## SimulatorDataSource Implementation

Runs GBM price generation every 500ms and writes to `PriceCache`.

```python
# backend/app/market/simulator.py  (SimulatorDataSource portion)

import asyncio
import logging
from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

class SimulatorDataSource(MarketDataSource):
    """MarketDataSource backed by GBMSimulator.

    Steps the simulation every update_interval seconds and writes results
    to PriceCache. See MARKET_SIMULATOR.md for GBMSimulator internals.
    """

    def __init__(self, price_cache: PriceCache, update_interval: float = 0.5, event_probability: float = 0.001) -> None:
        self._cache = price_cache
        self._interval = update_interval
        self._event_prob = event_probability
        self._sim: GBMSimulator | None = None
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._sim = GBMSimulator(tickers=tickers, event_probability=self._event_prob)
        # Seed cache immediately so SSE has data before first step
        for ticker in tickers:
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        if self._sim:
            self._sim.add_ticker(ticker)
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        if self._sim:
            self._sim.remove_ticker(ticker)
        self._cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return self._sim.get_tickers() if self._sim else []

    async def _run_loop(self) -> None:
        while True:
            try:
                if self._sim:
                    prices = self._sim.step()
                    for ticker, price in prices.items():
                        self._cache.update(ticker=ticker, price=price)
            except Exception:
                logger.exception("Simulator step failed")
            await asyncio.sleep(self._interval)
```

---

## SSE Integration

The streaming endpoint reads from `PriceCache` and pushes to connected clients. Uses `version` for change detection so idle frames are skipped.

```python
# backend/app/market/stream.py

import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from .cache import PriceCache

def create_stream_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter()

    @router.get("/api/stream/prices")
    async def stream_prices():
        return StreamingResponse(
            _generate_events(price_cache),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return router

async def _generate_events(cache: PriceCache):
    last_version = -1
    while True:
        current_version = cache.version
        if current_version != last_version:
            prices = cache.get_all()
            data = {ticker: update.to_dict() for ticker, update in prices.items()}
            yield f"data: {json.dumps(data)}\n\n"
            last_version = current_version
        await asyncio.sleep(0.5)
```

---

## Public API (Downstream Usage)

```python
from app.market import PriceCache, PriceUpdate, MarketDataSource, create_market_data_source

# Startup (in FastAPI lifespan)
cache = PriceCache()
source = create_market_data_source(cache)          # Reads MASSIVE_API_KEY
await source.start(["AAPL", "GOOGL", "MSFT", ...])

# Read prices (thread-safe, called from any context)
update: PriceUpdate | None = cache.get("AAPL")
price: float | None = cache.get_price("AAPL")
all_prices: dict[str, PriceUpdate] = cache.get_all()

# Dynamic watchlist changes
await source.add_ticker("TSLA")
await source.remove_ticker("GOOGL")

# Shutdown (in FastAPI lifespan teardown)
await source.stop()
```

---

## File Structure

```
backend/
  app/
    market/
      __init__.py         # Re-exports: PriceCache, PriceUpdate, MarketDataSource,
                          #             create_market_data_source, create_stream_router
      models.py           # PriceUpdate frozen dataclass
      interface.py        # MarketDataSource ABC
      cache.py            # PriceCache (thread-safe, version-tracked)
      factory.py          # create_market_data_source() — env-based selection
      massive_client.py   # MassiveDataSource
      simulator.py        # GBMSimulator + SimulatorDataSource
      seed_prices.py      # SEED_PRICES, TICKER_PARAMS, DEFAULT_PARAMS, CORRELATION_GROUPS
      stream.py           # create_stream_router() — FastAPI SSE endpoint factory
```

---

## Lifecycle Sequence

```
App startup (FastAPI lifespan)
│
├── Create PriceCache()
├── create_market_data_source(cache)   → picks Massive or Simulator
├── await source.start(watchlist_tickers)
│     ├── [Massive] immediate poll → cache has data before first request
│     └── [Simulator] seeds cache → cache has data before first request
│
│   App running
│   ├── SSE reads cache.get_all() every 500ms → pushes to clients
│   ├── Trade execution reads cache.get_price(ticker) → current price
│   ├── Portfolio valuation reads cache.get_all() → marks positions to market
│   └── Watchlist changes call source.add_ticker() / source.remove_ticker()
│
App shutdown (FastAPI lifespan teardown)
└── await source.stop()
```

---

## Design Notes

- **Producers never block consumers**: `PriceCache` uses a threading lock held for microseconds; SSE reads and data source writes don't contend meaningfully
- **No direct coupling**: the SSE endpoint, trade router, and portfolio router all import only `PriceCache` — they never import `SimulatorDataSource` or `MassiveDataSource`
- **Switching data sources**: change the `MASSIVE_API_KEY` env var and restart; no code changes needed
- **Frozen `PriceUpdate`**: immutability means cache snapshots (from `get_all()`) can be read without holding the lock
