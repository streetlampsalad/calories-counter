---
description: "Task list template for feature implementation (project override)"
---

# Tasks: [FEATURE NAME]

**Input**: `spec.md` and `plan.md` in this folder, plus `research.md`, `data-model.md` and `contracts/` where they exist.

**Spec issue**: #[NUMBER]

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

**Organisation**: each phase is one **Slice**: one Issue, one pull request, merged on its own. A Slice must leave `main` deployable, and the feature stays unreachable (no navigation link, no route) until the final Slice, which makes it reachable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: the user story the task belongs to (US1, US2, …)
- Give exact file paths

<!--
  Replace every sample task below. Fold setup and foundational work (migrations, query
  keys, shared components) into the first Slice that needs it. Use a separate
  "Foundation" Slice only when several stories need it and it can merge unreachable.
  A Slice should be small enough for one pull request a reviewer can read in one sitting.
-->

## Slice 1: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [What this Slice delivers]

**Covers**: US1.1, US1.2, FR-001

**Reachable after merge**: No (or Yes, for the final Slice)

### Tests (write first, see them fail)

- [ ] T001 [P] [US1] pgTAP: [RLS or function behaviour] in `supabase/tests/database/[name].test.sql`
- [ ] T002 [P] [US1] Vitest: [pure logic] in `src/features/[feature]/[name].test.ts`
- [ ] T003 [P] [US1] Testing Library: [component behaviour] in `src/features/[feature]/[Name].test.tsx`
- [ ] T004 [US1] Playwright: [journey] in `e2e/[name].spec.ts`

### Implementation

- [ ] T005 [US1] Migration `pnpm db:new [name]`, then `pnpm db:reset && pnpm db:types`
- [ ] T006 [US1] [Component, hook or route] in `src/...`

**Checkpoint**: `pnpm validate` passes and User Story 1 works on its own.

---

## Slice 2: User Story 2 - [Title] (Priority: P2)

**Goal**: [What this Slice delivers]

**Covers**: US2.1, FR-002

**Reachable after merge**: Yes

### Tests (write first, see them fail)

- [ ] T007 [P] [US2] [test] in `[path]`

### Implementation

- [ ] T008 [US2] [task] in `[path]`

**Checkpoint**: `pnpm validate` passes and User Stories 1 and 2 both work.

---

[Add a Slice per remaining user story, in priority order]

## Slices

The Spec's agent creates one Slice issue per row after the Spec pull request merges, as sub-issues of the Spec issue, with native "blocked by" links.

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | [title] | US1.1, US1.2 | T001–T006 | — | No |
| 2 | [title] | US2.1 | T007–T008 | Slice 1 | No |
