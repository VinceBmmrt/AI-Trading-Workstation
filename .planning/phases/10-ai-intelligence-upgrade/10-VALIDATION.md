---
phase: 10
slug: ai-intelligence-upgrade
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend), tsc --noEmit + next build (frontend) |
| **Config file** | `backend/pyproject.toml` |
| **Quick run command** | `uv run --extra dev pytest tests/ -x -q` |
| **Full suite command** | `uv run --extra dev pytest tests/ -v && cd frontend && npx tsc --noEmit && npx next build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `uv run --extra dev pytest tests/ -x -q`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| session baseline | 01 | 1 | proactive alerts | unit | `pytest tests/test_proactive.py -x -q` | ⬜ pending |
| proactive threshold | 01 | 1 | proactive alerts | unit | `pytest tests/test_proactive.py -x -q` | ⬜ pending |
| proactive cooldown | 01 | 1 | proactive alerts | unit | `pytest tests/test_proactive.py -x -q` | ⬜ pending |
| /api/chat/messages | 01 | 1 | new endpoints | integration | `pytest tests/test_chat.py -x -q` | ⬜ pending |
| /api/chat/market-summary | 01 | 1 | new endpoints | integration | `pytest tests/test_chat.py -x -q` | ⬜ pending |
| richer portfolio context | 01 | 1 | enriched prompt | unit | `pytest tests/test_chat.py -x -q` | ⬜ pending |
| frontend compilation | 02 | 2 | all frontend | build | `cd frontend && npx tsc --noEmit` | ⬜ pending |
| slash command expansion | 02 | 2 | slash commands | manual | Type /analyze in browser | ⬜ pending |
| proactive badge in chat | 02 | 2 | proactive UI | manual | Trigger alert, verify badge | ⬜ pending |
| market summary banner | 02 | 2 | market summary UI | manual | Page load, verify banner appears | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Market summary banner renders on page load | Frontend component, no unit tests | Open app, verify banner appears between header and main grid with non-empty text within 3 seconds |
| Slash command dropdown appears on `/` | UI interaction | Type `/` in chat input, verify dropdown shows /analyze, /rebalance, /risk |
| Proactive alert appears in chat within 5s | Requires live price movement | Wait for session to run >2% on any ticker, verify proactive bubble appears with amber badge |
| No regression on existing chat | Richer context changes system prompt | Send "what's in my portfolio?" — verify it still returns correct holdings |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or manual test instructions
- [ ] Backend: 128+ tests pass (no regressions)
- [ ] Frontend: tsc --noEmit exits 0
- [ ] Frontend: next build exits 0
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
