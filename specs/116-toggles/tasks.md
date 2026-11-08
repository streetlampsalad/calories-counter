---
description: "Tasks for Toggles for every new Feature"
---

# Tasks: Toggles for every new Feature

**Input**: `spec.md`, `plan.md` and `data-model.md` in this folder.

**Spec issue**: #116

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - The app knows whether a Toggle is on for me (Priority: P1) 🎯 MVP

**Goal**: the tables, functions and helpers that answer whether a Toggle is on for the signed-in User.

**Covers**: US1.1–US1.9, FR-001–FR-007, FR-010

**Reachable after merge**: No (no Toggle exists, and nothing calls the helpers yet)

### Tests (write first, see them fail)

- [ ] T001 [US1] pgTAP: states, the Owner's override, forward-only state, the Owner losing the mark, missing keys, and one User unable to read or change another's overrides, in `supabase/tests/database/019_toggles.test.sql`
- [ ] T002 [P] [US1] Vitest: `isToggleOn` returns the function's answer, and `false` on an error or no session, in `src/features/toggles/server.test.ts`
- [ ] T003 [P] [US1] Vitest + Testing Library: `useToggle` is `false` while loading, on error and for an unknown key, and follows `my_toggles()` once loaded; `useSwitchToggle` is optimistic and rolls back on error, in `src/features/toggles/queries.test.tsx`

### Implementation

- [ ] T004 [US1] Migration `pnpm db:new toggles` per `data-model.md`, then `pnpm db:reset && pnpm db:types`
- [ ] T005 [P] [US1] `isToggleOn(key)` in `src/features/toggles/server.ts`
- [ ] T006 [P] [US1] `toggleKeys`, `useToggles`, `useToggle` and `useSwitchToggle` in `src/features/toggles/queries.ts`

**Checkpoint**: `pnpm validate` passes. After deploy, the Owner sets `is_owner` on their Allowed Email in production (`human-step`).

---

## Slice 2: User Story 2 - The Owner tries features in Testing from Settings (Priority: P2)

**Goal**: the "Try new features" section in Settings.

**Covers**: US2.1–US2.5, FR-008, FR-009

**Reachable after merge**: Yes, for the Owner, once a Toggle in Testing exists

### Tests (write first, see them fail)

- [ ] T007 [P] [US2] Testing Library: lists Toggles the User can switch with their state; hidden when there are none or while loading; a failed save rolls back with a toast, in `src/features/settings/try-features-section.test.tsx`
- [ ] T008 [US2] Playwright: `gus` turns on "Example feature", reloads and sees it still on; `eve` sees no section, in `e2e/toggles.spec.ts`

### Implementation

- [ ] T009 [US2] Seed `gus@example.test` as the Owner and Toggle `feature-0` "Example feature" in Testing in `supabase/seed.sql`; add `gus` to `e2e/support/auth.ts`
- [ ] T010 [US2] `TryFeaturesSection` in `src/features/settings/try-features-section.tsx`, added to `src/app/(app)/settings/page.tsx` after the Vibration row

**Checkpoint**: `pnpm validate` passes and the Owner can try a Toggle in Testing.

---

## Slice 3: User Story 3 - Agents build every new Feature behind a Toggle (Priority: P3)

**Goal**: the repo's rules, templates and `/deliver` follow ADR 0008.

**Covers**: US3.1–US3.3, FR-011

**Reachable after merge**: Yes (it changes how agents work, not the app)

### Tests (write first, see them fail)

- [ ] T011 [US3] Before editing, `grep -rn "unreachable until\|feature-flag\|feature flags" AGENTS.md .specify docs/agents .claude/skills/deliver` lists every line to change; after, it lists none outside superseded ADRs

### Implementation

- [ ] T012 [US3] Principle III in `.specify/memory/constitution.md` (version 1.1.0) and the matching bullet in `AGENTS.md`: every merge leaves `main` deployable because every new Feature ships behind its Toggle, off for everyone (ADR 0008)
- [ ] T013 [P] [US3] `docs/agents/workflow.md`: the Toggle in the flow (the first Slice adds it; Done for a Feature means in production behind its Toggle) and the Toggle terms
- [ ] T014 [P] [US3] `.specify/templates/overrides/plan-template.md` (Constitution Check III) and `tasks-template.md` (the first Slice adds the Toggle; "Reachable after merge" becomes "Behind Toggle")
- [ ] T015 [P] [US3] `.claude/skills/deliver/spec.md` and `change.md`: add the Toggle in the first Slice, gate with `useToggle` and `isToggleOn`, and answer 404 from new routes while off
- [ ] T016 [P] [US3] `.claude/skills/deliver/triage.md`: accept when in doubt and record guesses in the spec's Assumptions; **Ask** only for product or risk decisions the Owner must make

**Checkpoint**: T011's `grep` lists nothing to change.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Toggles in the database and the app's helpers | US1.1–US1.9 | T001–T006 | — | Yes (RLS, human step) |
| 2 | Try new features in Settings | US2.1–US2.5 | T007–T010 | Slice 1 | No |
| 3 | Every new Feature behind a Toggle | US3.1–US3.3 | T011–T016 | Slice 1 | Yes (guardrails) |
