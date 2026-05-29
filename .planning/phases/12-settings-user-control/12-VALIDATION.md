---
phase: 12
slug: settings-user-control
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) + Playwright (E2E) |
| **Config file** | `backend/pyproject.toml` |
| **Quick run command** | `cd backend && uv run --extra dev pytest tests/test_settings.py -v` |
| **Full suite command** | `cd backend && uv run --extra dev pytest -v` |
| **Estimated runtime** | ~15 seconds (unit) / ~60 seconds (full + E2E) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run --extra dev pytest tests/test_settings.py -v`
- **After every plan wave:** Run full backend suite + manual browser checks
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 12-01-01 | 01 | 1 | DB schema | `app_settings` table created; INSERT OR IGNORE seeds default row | unit | `pytest tests/test_db.py -v` | ⬜ pending |
| 12-01-02 | 01 | 1 | Settings API | GET returns `{"starting_capital": 10000.0}`; PUT validates > 0 | unit | `pytest tests/test_settings.py::TestSettings -v` | ⬜ pending |
| 12-01-03 | 01 | 1 | Portfolio reset | POST /reset clears positions/trades/snapshots; preserves chat+alerts | unit | `pytest tests/test_settings.py::TestReset -v` | ⬜ pending |
| 12-01-04 | 01 | 1 | Starting capital fix | `get_analytics` reads starting_capital from DB (not hardcoded) | unit | `pytest tests/test_settings.py::test_analytics_uses_db_starting_capital -v` | ⬜ pending |
| 12-01-05 | 01 | 1 | Router registration | `GET /api/settings` returns 200 on running server | unit | `pytest tests/test_settings.py -v` | ⬜ pending |
| 12-02-01 | 02 | 2 | Theme toggle | Light class applied/removed on html element | manual | Browser smoke test | ⬜ pending |
| 12-02-02 | 02 | 2 | Layout persist | selectedTicker/chatOpen/portfolioTab restored after reload | manual | Browser smoke test | ⬜ pending |
| 12-02-03 | 02 | 2 | Settings panel | Gear icon opens panel; starting capital updates; reset works | manual | Browser smoke test | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_settings.py` — stubs for all settings + reset unit tests
- [ ] `app_settings` table registered in SCHEMA_SQL before tests import the app

*Existing pytest infrastructure in `backend/pyproject.toml` covers the test runner setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Theme toggle persists across reload | Success Criterion 4 | CSS visual state + localStorage | Switch to light, reload, verify theme preserved |
| Light theme has no illegible text | Success Criterion 4 | Requires visual inspection | Enable light mode, check all components for contrast |
| Layout state restores on reload | Success Criterion 3 | localStorage browser behavior | Set ticker+tab+chat state, reload, verify all restored |
| Portfolio reset shows $0 P&L | Success Criterion 1 | Requires UI render + price cache | Buy shares, reset, verify header P&L = $0 |
| Starting capital persists across container restart | Success Criterion 2 | Requires Docker restart | Set 25000, stop/start container, verify setting persists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
