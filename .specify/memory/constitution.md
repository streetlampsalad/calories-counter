# Calories Counter Constitution

The hard rules every spec, plan and task must pass. Each one is explained where it lives: [`AGENTS.md`](../../AGENTS.md), [`CONTEXT.md`](../../CONTEXT.md) and [`docs/adr/`](../../docs/adr/). When this file and those disagree, they win and this file is out of date.

## Core Principles

### I. The glossary is the language

Specs, code, UI copy, tests and commits use the terms in `CONTEXT.md` exactly. A spec that needs a new term adds it to `CONTEXT.md` in the same Spec pull request.

### II. Test first, at the right layer

Every acceptance scenario has a test that fails without the change, written before the code: Vitest for pure logic, Testing Library for components, pgTAP for schema, RLS and database functions, Playwright for user journeys. Every new table has pgTAP tests proving one User cannot read or change another User's rows.

### III. Every merge leaves `main` deployable

Each Slice is one pull request that passes `pnpm validate` in CI. Every new Feature ships behind its own Toggle, off for everyone: the first Slice adds it, every Slice gates its new behaviour on it, and with the Toggle off the app behaves exactly as before (ADR 0008).

### IV. Migrations ship before the app

The schema changes only through a new migration. Committed migrations are immutable, and each one must work with the app version currently in production. Daily Totals are computed, never stored (ADR 0001).

### V. Secrets stay on the server

Third-party API keys are read only in route handlers or server actions, never through `NEXT_PUBLIC_*`. Agents never edit `.env*` files or touch the production database.

### VI. Phone first

Design for a 360–412 px Android phone: touch targets at least 44 px and the main actions within thumb reach. Copy is Australian English with metric units.

### VII. Risk decides who reviews

Every spec and every Bug or Chore carries a Risk assessment (`docs/agents/workflow.md`). Anything that adds an integration, is irreversible, cannot be proved in CI, touches sign-in or RLS, changes the guardrails, conflicts with an ADR, or is Size L or XL needs Human review. Everything else may reach production with no human in the loop.

## Governance

This constitution changes only through a pull request with Human review. Adding or changing a principle also updates `AGENTS.md` or the ADR it summarises.

**Version**: 1.1.0 | **Ratified**: 2026-11-08 | **Last Amended**: 2026-11-08 (III: Toggles, ADR 0008)
