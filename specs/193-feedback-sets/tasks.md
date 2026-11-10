---
description: "Tasks for Several sets of feedback"
---

# Tasks: Several sets of feedback, each an enhancement or a bug

**Input**: `spec.md`, `plan.md`, `data-model.md` and `contracts.md` in this folder.

**Spec issue**: #193

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - Send several sets of feedback in one Round (Priority: P1) 🎯 MVP

**Goal**: the sets stored with the Round, one follow-up Feature Issue with a section per set, and the sheet that edits them.

**Covers**: US1.1–US1.9, FR-001, FR-003, FR-005, FR-006

**Behind Toggle**: `feature-114`

### Tests (write first, see them fail)

- [x] T001 [P] [US1] pgTAP: the new overload stores `sets` and `feedback`, refuses 0, 6, short, long and unknown-category sets, is `service_role` only, the old overload still works, a request whose `decision` is set is refused; another User cannot read the sets, in `supabase/tests/database/026_feedback_sets.test.sql`
- [x] T002 [P] [US1] Vitest: `parseSets` in `domain.test.ts`; the Issue body with sets and counts, in `issue-body.test.ts`; `giveFeedback` checks, limit, rollback, in `feedback.test.ts` (including a legacy `feedback` string)
- [x] T003 [P] [US1] Testing Library: the sheet's single starting set, categories, add and remove, 5-set cap, per-set errors, limit, and sets kept on error, in `feedback-sheet.test.tsx`
- [x] T004 [US1] Playwright: `liv` sends one bug set and two enhancement sets and sees Submitted, in `e2e/feature-requests.spec.ts`

### Implementation

- [x] T005 [US1] Migration `pnpm db:new feedback_sets` per `data-model.md`, then `pnpm db:reset && pnpm db:types`
- [x] T006 [US1] `parseSets` in `domain.ts`; `followUpBody` with sets in `issue-body.ts`; `giveFeedback` and its dependency in `feedback.ts`, `actions.ts`, `queries.ts`
- [x] T007 [US1] The sets editor in `feedback-sheet.tsx`
- [x] T008 [US1] Add `Feedback set` to `CONTEXT.md`

**Checkpoint**: `pnpm validate` passes.

---

## Slice 2: User Story 2 - See each set under the request (Priority: P2)

**Goal**: the card lists each Round's sets with their categories.

**Covers**: US2.1–US2.3, FR-002, FR-004

**Behind Toggle**: `feature-114`

### Tests (write first, see them fail)

- [x] T009 [P] [US2] Testing Library: the sets with categories, and a Round with no sets as one note, in `request-card.test.tsx`
- [x] T010 [P] [US2] pgTAP: another User reads none of a Requester's sets (added to `026_feedback_sets.test.sql`, or covered by T001)

### Implementation

- [x] T011 [US2] Load `sets` in `queries.ts`; list them under each Round in `request-card.tsx`

**Checkpoint**: `pnpm validate` passes.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Send several sets of feedback in one Round | US1.1–US1.9 | T001–T008 | — | Yes (new `security definer` function; merge gate flags it) |
| 2 | See each set under the request | US2.1–US2.3 | T009–T011 | Slice 1 | No |
