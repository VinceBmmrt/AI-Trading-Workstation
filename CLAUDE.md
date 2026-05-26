# AI Trading Workstation Project - the Finance Ally

All project documentation is in the `planning` directory.

The key document is PLAN.md included in full below; the market data component has been completed and is summarized in the file `planning/MARKET_DATA_SUMMARY.md` with more details in the `planning/archive` folder. Consult these docs only when required. The remainder of the platform is still to be developed.

@planning/PLAN.md

<!-- GSD:project-start source:PROJECT.md -->

## Project

**AI Trading Workstation — Finance Ally**

An AI-powered trading terminal that streams live market data, lets users trade a simulated portfolio ($10k virtual cash), and integrates an LLM chat assistant that can analyze positions, suggest trades, and execute them on the user's behalf. Built as a capstone for an agentic AI coding course — the entire application is authored by orchestrated AI agents. Visually inspired by Bloomberg/trading terminals with a dark, data-dense aesthetic.

**Core Value:** A user opens a browser, sees live streaming prices, buys and sells with one click, and converses with an AI that acts on their behalf — all in a single Docker container, zero setup.

### Constraints

- **Tech Stack**: Python/uv (no pip), FastAPI, Next.js static export, SQLite — no substitutions; students follow this exactly
- **Single Port**: Everything on port 8000 — no CORS, no separate frontend server in production
- **Single Container**: One `docker run` command — no docker-compose for production use
- **Environment**: `.env` at project root; `OPENROUTER_API_KEY` required; `MASSIVE_API_KEY` and `LLM_MOCK` optional
- **LLM**: Cerebras via OpenRouter (`openrouter/openai/gpt-oss-120b`, provider order: `["cerebras"]`) — not configurable by user

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| cerebras-inference | Use this to write code to call an LLM using LiteLLM and OpenRouter with the Cerebras inference provider | `.claude/skills/cerebras/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
