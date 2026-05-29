---
phase: 11
slug: price-alerts-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) + Playwright (E2E) |
| **Config file** | `backend/pyproject.toml` |
| **Quick run command** | `cd backend && uv run --extra dev pytest tests/test_alerts.py -v` |
| **Full suite command** | `cd backend && uv run --extra dev pytest -v` |
| **Estimated runtime** | ~15 seconds (unit) / ~60 seconds (full + E2E) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run --extra dev pytest tests/test_alerts.py -v`
- **After every plan wave:** Run full backend suite + Playwright E2E
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 11-01-01 | 01 | 1 | DB schema | Alert rows created with correct columns | unit | `pytest tests/test_alerts.py::test_create_alert_valid` | ⬜ pending |
| 11-01-02 | 01 | 1 | API POST | 400 on bad ticker format | unit | `pytest tests/test_alerts.py::test_create_alert_invalid_ticker_format` | ⬜ pending |
| 11-01-03 | 01 | 1 | Alert check | Alert fires above threshold | unit | `pytest tests/test_alerts.py::test_alert_fires_above` | ⬜ pending |
| 11-01-04 | 01 | 1 | Alert check | Alert fires below threshold | unit | `pytest tests/test_alerts.py::test_alert_fires_below` | ⬜ pending |
| 11-01-05 | 01 | 1 | Idempotency | Once active=0, no re-fire | unit | `pytest tests/test_alerts.py::test_alert_idempotent` | ⬜ pending |
| 11-01-06 | 01 | 1 | AI context | Fired alert in portfolio context within 30 min | unit | `pytest tests/test_alerts.py::test_alert_context_in_portfolio` | ⬜ pending |
| 11-01-07 | 01 | 1 | AI context | Old alert excluded from context | unit | `pytest tests/test_alerts.py::test_alert_context_old_excluded` | ⬜ pending |
| 11-02-01 | 02 | 2 | Toast UI | Toast appears on alert_fired SSE event | manual | Browser smoke test | ⬜ pending |
| 11-02-02 | 02 | 2 | Bell icon | Bell shows filled/amber when active alerts exist | manual | Browser smoke test | ⬜ pending |
| 11-02-03 | 02 | 2 | Persistence | Alerts reload after page refresh | manual | Browser smoke test | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_alerts.py` — stubs for all alert unit tests listed above
- [ ] Alert route registered in `backend/app/main.py` (so tests can import it)

*Existing pytest infrastructure in `backend/pyproject.toml` covers the test runner setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toast notification appears bottom-right | Success Criterion 2 | Requires browser render | Open app, set alert via bell icon, wait for price cross, verify toast appears |
| Bell icon fills amber when alert is active | UI requirement | CSS visual state | Add an alert, verify bell icon fills in the watchlist row |
| Alert creation popover opens on hover | UI requirement | CSS hover interaction | Hover over a watchlist row, verify bell icon appears and is clickable |
| AI chat references fired alert | Success Criterion 3 | Requires LLM call | Fire an alert, then send any chat message, verify response mentions the alert |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
