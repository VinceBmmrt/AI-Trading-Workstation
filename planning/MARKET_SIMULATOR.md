# Market Simulator Design

Approach and code structure for simulating realistic stock prices when `MASSIVE_API_KEY` is not set. The default mode for development and demos.

---

## Overview

The simulator uses **Geometric Brownian Motion (GBM)** to generate realistic stock price paths. GBM is the standard stochastic process underlying Black-Scholes option pricing. Prices evolve multiplicatively with random noise, can never go negative, and produce the lognormal distribution observed in real equity markets.

Three layers of realism:
1. **Per-ticker parameters** — each stock has its own annualized volatility and drift
2. **Correlated moves** — tech stocks move together, finance stocks move together (via Cholesky decomposition)
3. **Random shock events** — occasional 2–5% sudden moves add visual drama

Updates run every 500ms, producing a continuous stream of small price changes.

---

## GBM Math

At each time step, a stock price evolves as:

```
S(t+dt) = S(t) × exp( (μ - σ²/2) × dt  +  σ × √dt × Z )
```

| Symbol | Meaning |
|--------|---------|
| `S(t)` | Current price |
| `μ` (mu) | Annualized drift (expected return), e.g. 0.05 = 5%/year |
| `σ` (sigma) | Annualized volatility, e.g. 0.20 = 20%/year |
| `dt` | Time step as a fraction of a trading year |
| `Z` | Standard normal random variable N(0, 1) |

The `exp()` ensures prices stay positive. The `(μ - σ²/2)` term is the Itô correction that makes the expectation `E[S(t)] = S(0) × e^(μt)` — without it, volatility would bias prices downward.

### Time Step Calculation

500ms expressed as a fraction of a trading year (252 days × 6.5 hours/day):

```python
TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600  # = 5,896,800 seconds
DEFAULT_DT = 0.5 / TRADING_SECONDS_PER_YEAR   # ≈ 8.48e-8
```

This tiny `dt` produces sub-cent moves per tick. With `σ=0.25` (moderate volatility) and 2 ticks/second, the daily simulated price range is approximately `σ × √(1/252) ≈ 1.6%` — consistent with real market behavior.

---

## Correlated Moves

Real stocks don't move independently. Tech stocks (AAPL, MSFT, GOOGL) tend to move together during broad market moves. To model this, we use **Cholesky decomposition** of a correlation matrix.

### Approach

1. Build an `n × n` correlation matrix `C` for the current ticker set
2. Decompose: `L = cholesky(C)` where `L` is lower-triangular
3. At each step, generate `n` independent standard normals `Z_independent`
4. Transform: `Z_correlated = L @ Z_independent`

The correlated `Z_correlated[i]` is then used in the GBM formula for ticker `i`. This preserves the marginal N(0,1) distribution for each ticker while introducing the specified pairwise correlations.

### Correlation Structure

```python
# backend/app/market/seed_prices.py

CORRELATION_GROUPS = {
    "tech":    {"AAPL", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "NFLX"},
    "finance": {"JPM", "V"},
}

INTRA_TECH_CORR    = 0.6   # Tech stocks move together (moderate-high)
INTRA_FINANCE_CORR = 0.5   # Finance stocks move together
CROSS_GROUP_CORR   = 0.3   # Between sectors or unknown tickers
TSLA_CORR          = 0.3   # TSLA does its own thing (even vs other tech)
```

Rule applied in `_pairwise_correlation(t1, t2)`:
- Both in `tech` (excluding TSLA): `0.6`
- Both in `finance`: `0.5`
- Either is TSLA: `0.3`
- Otherwise (cross-sector, or unknown ticker): `0.3`

The correlation matrix must be **positive semi-definite** for Cholesky to succeed. With only two levels of correlation (0.6 and 0.3 for groups of reasonable size), this holds. If Cholesky fails for an unusual ticker set, the simulator falls back to uncorrelated moves.

---

## Random Shock Events

Every step, each ticker has a small independent probability of a sudden large move:

```python
event_probability = 0.001  # 0.1% per tick per ticker

if random.random() < event_probability:
    shock_magnitude = random.uniform(0.02, 0.05)   # 2–5% move
    shock_sign = random.choice([-1, 1])             # up or down
    price *= (1 + shock_magnitude * shock_sign)
```

With 10 tickers at 2 ticks/second, the expected time between events across the whole watchlist is:

```
1 / (10 tickers × 2 ticks/s × 0.001) = 50 seconds
```

Roughly one notable move every 50 seconds — enough visual drama without being chaotic.

---

## Seed Prices

Realistic starting prices for the default 10-ticker watchlist:

```python
# backend/app/market/seed_prices.py

SEED_PRICES: dict[str, float] = {
    "AAPL": 190.00,
    "GOOGL": 175.00,
    "MSFT": 420.00,
    "AMZN": 185.00,
    "TSLA": 250.00,
    "NVDA": 800.00,
    "META": 500.00,
    "JPM":  195.00,
    "V":    280.00,
    "NFLX": 600.00,
}
```

For tickers not in this list (dynamically added), a deterministic seed based on the ticker string is used:

```python
seed_price = random.Random(ticker).uniform(50.0, 300.0)
```

Using `random.Random(ticker)` makes the starting price reproducible across restarts — the same ticker always starts at the same price.

---

## Per-Ticker Parameters

Each ticker has its own `sigma` (volatility) and `mu` (drift):

```python
# backend/app/market/seed_prices.py

TICKER_PARAMS: dict[str, dict[str, float]] = {
    "AAPL":  {"sigma": 0.22, "mu": 0.05},
    "GOOGL": {"sigma": 0.25, "mu": 0.05},
    "MSFT":  {"sigma": 0.20, "mu": 0.05},
    "AMZN":  {"sigma": 0.28, "mu": 0.05},
    "TSLA":  {"sigma": 0.50, "mu": 0.03},  # High volatility
    "NVDA":  {"sigma": 0.40, "mu": 0.08},  # High vol, strong growth drift
    "META":  {"sigma": 0.30, "mu": 0.05},
    "JPM":   {"sigma": 0.18, "mu": 0.04},  # Low vol (bank)
    "V":     {"sigma": 0.17, "mu": 0.04},  # Low vol (payments)
    "NFLX":  {"sigma": 0.35, "mu": 0.05},
}

DEFAULT_PARAMS: dict[str, float] = {"sigma": 0.25, "mu": 0.05}
```

These values approximate real historical annualized volatilities. TSLA at `σ=0.50` is notably more erratic; JPM and V at `σ≤0.18` are comparatively stable.

---

## GBMSimulator Implementation

```python
# backend/app/market/simulator.py

import math
import random
import logging
import numpy as np
from .seed_prices import (
    SEED_PRICES, TICKER_PARAMS, DEFAULT_PARAMS,
    CORRELATION_GROUPS, INTRA_TECH_CORR, INTRA_FINANCE_CORR,
    CROSS_GROUP_CORR, TSLA_CORR,
)

logger = logging.getLogger(__name__)

class GBMSimulator:
    """Correlated GBM price simulator for multiple tickers.

    Math:
        S(t+dt) = S(t) * exp((mu - sigma^2/2) * dt + sigma * sqrt(dt) * Z)

    Z values are correlated via Cholesky decomposition of a sector-based
    correlation matrix. Rebuilds the matrix whenever tickers are added/removed.
    """

    TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600  # 5,896,800
    DEFAULT_DT = 0.5 / TRADING_SECONDS_PER_YEAR   # ~8.48e-8

    def __init__(
        self,
        tickers: list[str],
        dt: float = DEFAULT_DT,
        event_probability: float = 0.001,
    ) -> None:
        self._dt = dt
        self._event_prob = event_probability
        self._tickers: list[str] = []
        self._prices: dict[str, float] = {}
        self._params: dict[str, dict[str, float]] = {}
        self._cholesky: np.ndarray | None = None

        for ticker in tickers:
            self._add_ticker_internal(ticker)
        self._rebuild_cholesky()

    def step(self) -> dict[str, float]:
        """Advance all tickers by one time step. Returns {ticker: new_price}.

        Hot path — called every 500ms. O(n) where n = number of tickers.
        """
        n = len(self._tickers)
        if n == 0:
            return {}

        # Correlated normal draws via Cholesky
        z = np.random.standard_normal(n)
        if self._cholesky is not None:
            z = self._cholesky @ z

        result: dict[str, float] = {}
        for i, ticker in enumerate(self._tickers):
            mu = self._params[ticker]["mu"]
            sigma = self._params[ticker]["sigma"]

            drift = (mu - 0.5 * sigma**2) * self._dt
            diffusion = sigma * math.sqrt(self._dt) * z[i]
            self._prices[ticker] *= math.exp(drift + diffusion)

            # Random shock event
            if random.random() < self._event_prob:
                shock = random.uniform(0.02, 0.05) * random.choice([-1, 1])
                self._prices[ticker] *= (1 + shock)
                logger.debug("Shock event: %s %.1f%%", ticker, shock * 100)

            result[ticker] = round(self._prices[ticker], 2)

        return result

    def add_ticker(self, ticker: str) -> None:
        """Add a ticker. Rebuilds the correlation matrix."""
        if ticker in self._prices:
            return
        self._add_ticker_internal(ticker)
        self._rebuild_cholesky()

    def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker. Rebuilds the correlation matrix."""
        if ticker not in self._prices:
            return
        self._tickers.remove(ticker)
        del self._prices[ticker]
        del self._params[ticker]
        self._rebuild_cholesky()

    def get_price(self, ticker: str) -> float | None:
        return self._prices.get(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    def _add_ticker_internal(self, ticker: str) -> None:
        """Add without rebuilding Cholesky (for batch init)."""
        self._tickers.append(ticker)
        seed = SEED_PRICES.get(ticker)
        if seed is None:
            seed = random.Random(ticker).uniform(50.0, 300.0)  # deterministic per ticker
        self._prices[ticker] = seed
        self._params[ticker] = dict(TICKER_PARAMS.get(ticker, DEFAULT_PARAMS))

    def _rebuild_cholesky(self) -> None:
        """Rebuild Cholesky of the n×n correlation matrix. O(n^2), n < 50."""
        n = len(self._tickers)
        if n <= 1:
            self._cholesky = None
            return

        corr = np.eye(n)
        for i in range(n):
            for j in range(i + 1, n):
                rho = self._pairwise_correlation(self._tickers[i], self._tickers[j])
                corr[i, j] = rho
                corr[j, i] = rho

        try:
            self._cholesky = np.linalg.cholesky(corr)
        except np.linalg.LinAlgError:
            logger.warning("Correlation matrix not positive-definite; using uncorrelated moves")
            self._cholesky = None

    @staticmethod
    def _pairwise_correlation(t1: str, t2: str) -> float:
        tech    = CORRELATION_GROUPS["tech"]
        finance = CORRELATION_GROUPS["finance"]

        if t1 == "TSLA" or t2 == "TSLA":
            return TSLA_CORR
        if t1 in tech and t2 in tech:
            return INTRA_TECH_CORR
        if t1 in finance and t2 in finance:
            return INTRA_FINANCE_CORR
        return CROSS_GROUP_CORR
```

---

## SimulatorDataSource (Async Wrapper)

`SimulatorDataSource` wraps `GBMSimulator` in an asyncio task and satisfies the `MarketDataSource` interface:

```python
class SimulatorDataSource(MarketDataSource):
    def __init__(self, price_cache: PriceCache, update_interval: float = 0.5, event_probability: float = 0.001):
        self._cache = price_cache
        self._interval = update_interval
        self._event_prob = event_probability
        self._sim: GBMSimulator | None = None
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._sim = GBMSimulator(tickers=tickers, event_probability=self._event_prob)
        # Seed cache so SSE has data immediately on startup
        for ticker in tickers:
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")

    async def _run_loop(self) -> None:
        while True:
            try:
                if self._sim:
                    for ticker, price in self._sim.step().items():
                        self._cache.update(ticker=ticker, price=price)
            except Exception:
                logger.exception("Simulator step failed")
            await asyncio.sleep(self._interval)

    # add_ticker, remove_ticker, stop, get_tickers — see MARKET_INTERFACE.md
```

The `_run_loop` task runs on the asyncio event loop. `GBMSimulator.step()` is synchronous Python (numpy operations); it completes in < 1ms for 50 tickers, so no thread offloading is needed.

---

## File Structure

```
backend/
  app/
    market/
      simulator.py        # GBMSimulator + SimulatorDataSource
      seed_prices.py      # SEED_PRICES, TICKER_PARAMS, DEFAULT_PARAMS,
                          # CORRELATION_GROUPS, correlation constants
```

All simulator logic lives in `simulator.py`. Constants (seed prices, params, correlation groups) are isolated in `seed_prices.py` for easy tuning without touching simulation logic.

---

## Behavior Notes

- **Prices never go negative** — GBM is multiplicative; `exp()` is always positive
- **Sub-cent moves per tick** — with `dt ≈ 8.5e-8`, even high-vol TSLA (`σ=0.50`) moves only ~0.003% per tick on average; this accumulates naturally to realistic intraday ranges
- **TSLA's daily range** — `σ=0.50`, 1 trading day = 252 ticks × 2/s × 0.5s ≈ after 6.5h: `0.50 × √(1/252) ≈ 3.1%` typical daily range — consistent with real TSLA behavior
- **Cholesky rebuild is O(n²)** but `n < 50` tickers in practice — completes in < 0.1ms
- **Deterministic seeds for unknown tickers** — `random.Random(ticker).uniform(50, 300)` produces the same starting price for the same ticker string on every restart
- **Cholesky fallback** — if the correlation matrix is not positive-definite (unusual ticker composition), `self._cholesky = None` and moves become uncorrelated; simulation continues without interruption
- **Random events are independent** — the `random.random()` check for shock events is separate from the Cholesky-correlated `Z` draws; shocks don't propagate across tickers

---

## Tuning

To adjust simulation behavior without changing code, edit `seed_prices.py`:

| Change | Edit |
|--------|------|
| Make a ticker more volatile | Increase its `sigma` in `TICKER_PARAMS` |
| Adjust sector correlation | Change `INTRA_TECH_CORR`, `INTRA_FINANCE_CORR`, etc. |
| Add a new sector group | Add an entry to `CORRELATION_GROUPS` and handle it in `_pairwise_correlation` |
| Change shock frequency | Adjust `event_probability` in `SimulatorDataSource.__init__` |
| Update starting prices | Edit `SEED_PRICES` |
