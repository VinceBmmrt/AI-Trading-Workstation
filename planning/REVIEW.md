# Change Review — 2026-05-22

**Branch:** main  
**Files changed:** `README.md`, `backend/pyproject.toml`, `backend/uv.lock`, `backend/app/market/cache.py`, `backend/app/market/massive_client.py`, `backend/app/market/simulator.py`, `backend/app/market/stream.py`, `backend/market_data_demo.py`

---

## Summary Table

| File | Type | Assessment |
|---|---|---|
| `README.md` | Fix | Correct — Docker names with spaces were invalid |
| `pyproject.toml` | Fix + refactor | Correct — package name fixed, `rich` reclassified to dev |
| `uv.lock` | Auto-generated | Consistent with `pyproject.toml` changes |
| `backend/app/market/cache.py` | Thread-safety fix | Correct — `version` property now lock-protected |
| `backend/app/market/massive_client.py` | Defensive fix | Correct — handles missing `last_trade` gracefully |
| `backend/app/market/simulator.py` | Robustness + UX | Correct — deterministic seed prices, Cholesky guard, ticker normalisation |
| `backend/app/market/stream.py` | Enhancement | Correct — SSE keepalive heartbeat prevents proxy drops |
| `backend/market_data_demo.py` | **Critical bug fix** | Was a `SyntaxError` (`AI Trading Workstation:` label instead of `finally:`) |

---

## File-by-File Details

### README.md
Docker image/volume names used spaces (`AI Trading Workstation`), which are invalid for Docker. Corrected to lowercase-hyphenated form (`ai-trading-workstation`, `ai-trading-workstation-data`), consistent with the plan spec. DB description updated to match the architecture decision log. **No issues.**

### backend/pyproject.toml + uv.lock
Project name `AI Trading Workstation-backend` is not PEP 508-compliant. Fixed to `ai-trading-workstation-backend`. `rich` moved from runtime `dependencies` to `[optional-dependencies] dev` — correct, since `rich` is only used in `market_data_demo.py` (a developer tool, not the FastAPI app). Requires `uv sync --extra dev` to use the demo script.

### backend/app/market/cache.py
`version` property previously read `self._version` without holding the lock — a data race. Fixed by wrapping the read in `with self._lock`. **Correct fix.**

### backend/app/market/massive_client.py
Unconditional access to `snap.last_trade.price` would raise `AttributeError` when `last_trade` is `None` (common outside market hours or for thinly traded tickers). New fallback chain:
1. Use `last_trade.price` if available and > 0
2. Fall back to `prev_day.close`
3. Raise `ValueError("no usable price")` — caught by the outer except block

When `last_trade` is `None`, `timestamp=None` is passed to `cache.update()`, which correctly falls back to `time.time()` (line 30 of `cache.py`). **Correct fix.**

### backend/app/market/simulator.py
Three improvements:
1. **Deterministic seed prices** — unknown tickers now use `random.Random(ticker).uniform(50.0, 300.0)` instead of global `random`, so the same ticker always starts at the same price across restarts.
2. **Cholesky guard** — `np.linalg.cholesky` can raise `LinAlgError` if the correlation matrix is not positive-definite (e.g. after an unusual ticker is added). Now caught with a try/except; `_cholesky` set to `None` and `step()` falls back to uncorrelated moves.
3. **Ticker normalisation** — `ticker.upper().strip()` applied in `SimulatorDataSource.add_ticker` / `remove_ticker`, matching `MassiveDataSource` behaviour.

### backend/app/market/stream.py
Added `heartbeat_interval` (default 15s). When no version change occurs for that interval, the generator yields a SSE comment (`: keepalive\n\n`), keeping the TCP connection alive through proxies. In simulator mode (500ms updates) the heartbeat never fires — it's a no-op there. Meaningful protection for the Massive API path (15s poll interval). **Correct enhancement.**

### backend/market_data_demo.py
**Critical fix.** Original code had:
```python
AI Trading Workstation:   # ← SyntaxError stray label
    await source.stop()
```
Replaced with `finally:` to produce the correct `try/except KeyboardInterrupt / finally:` pattern. Without this fix the script fails at parse time.

---

## Issues to Address Before Merging

1. **`rich` is now dev-only** — `market_data_demo.py` requires `uv sync --extra dev`. Should be noted in contributor docs.
2. **Stream heartbeat is dead code in simulator mode** — harmless but only provides real protection on the Massive API path.
3. **No new tests** for the `massive_client.py` fallback logic or the Cholesky guard. Follow-up item.
