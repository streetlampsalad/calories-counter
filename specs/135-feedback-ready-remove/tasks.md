---
description: "Tasks for Feedback, Ready and Remove for Feature Requests"
---

# Tasks: Feedback, Ready and Remove for Feature Requests

**Input**: `spec.md`, `plan.md`, `data-model.md` and `contracts.md` in this folder.

**Spec issue**: #135

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - Give feedback, and get another Round (Priority: P1) 🎯 MVP

**Goal**: Rounds, the follow-up Feature Issue, the sync following the newest Round, and the Give feedback sheet.

**Covers**: US1.1–US1.11, FR-001–FR-005, FR-008, FR-009

**Behind Toggle**: `feature-114`

### Tests (write first, see them fail)

- [ ] T001 [P] [US1] pgTAP: Rounds private to their Requester; the sync follows the newest Round and ignores older Issues; `first_ready_at` set on the first Ready to try; notified again on a Round's Ready to try; the Requester keeps their switch during a Round, in `supabase/tests/database/023_feature_request_rounds.test.sql`
- [ ] T002 [P] [US1] Vitest: the follow-up Issue's title and headings, in `issue-body.test.ts`; `giveFeedback` checks, limit, order and rollback, in `feedback.test.ts`; `canDecide`, and `canWithdraw` false once the request has been Ready to try, in `stage.test.ts`; Withdraw refused once `first_ready_at` is set, in `withdraw.test.ts`; `newestPerRequest`, in `scripts/workflow/feature-requests.test.mjs`
- [ ] T003 [P] [US1] Vitest: `### Follow-up to` in the Feature template, `triage.md` and `/deliver`'s `spec.md`, in `scripts/workflow/feature-template.test.mjs`
- [ ] T004 [P] [US1] Testing Library: the three actions only at Ready to try with the Toggle in Testing; the Rounds list, in `request-card.test.tsx`; the sheet's validation, notice, limit and errors, in `feedback-sheet.test.tsx`
- [ ] T005 [US1] Playwright: `liv` gives feedback on a Ready to try request and sees Submitted with the Round, in `e2e/feature-requests.spec.ts`

### Implementation

- [ ] T006 [US1] Migration `pnpm db:new feature_request_rounds` per `data-model.md`, then `pnpm db:reset && pnpm db:types`
- [ ] T007 [US1] `followUpTo` in `issue-body.ts`; `feedback.ts` and `giveFeedback` in `actions.ts`; `useGiveFeedback` and Rounds in `queries.ts`
- [ ] T008 [US1] `canDecide` and the `first_ready_at` check in `canWithdraw` in `stage.ts`; `markWithdrawn` also requires `first_ready_at is null` in `actions.ts`; `feedback-sheet.tsx`; the actions row and Rounds in `request-card.tsx`
- [ ] T009 [US1] `newestPerRequest` in `scripts/workflow/feature-requests.mjs`, used by `feature-requests-sync.mjs`
- [ ] T010 [US1] `### Follow-up to` in `.github/ISSUE_TEMPLATE/1-feature.yml`; follow-ups in `.claude/skills/deliver/triage.md` and `spec.md` (reuse Toggle `feature-<n>`, add no new one)

**Checkpoint**: `pnpm validate` passes.

---

## Slice 2: User Story 2 - Mark it ready (Priority: P2)

**Goal**: It's ready: the Toggle-removal Chore, then Live.

**Covers**: US2.1–US2.4, FR-006 (ready)

**Behind Toggle**: `feature-114`

### Tests (write first, see them fail)

- [ ] T011 [P] [US2] Vitest: `decide` creates the Chore first, then sets Live, closes the Chore again when the Toggle is no longer in Testing, and changes nothing when the Chore fails; the Chore's title and body, in `decide.test.ts`
- [ ] T012 [P] [US2] Testing Library: the confirm sheet, Keep testing, and errors, in `decide-sheet.test.tsx`
- [ ] T013 [US2] Playwright: `liv` marks a request ready and sees Live for everyone, in `e2e/feature-requests.spec.ts`

### Implementation

- [ ] T014 [US2] Migration `pnpm db:new feature_request_decisions` (`decision`, `cleanup_issue`), then `pnpm db:reset && pnpm db:types`
- [ ] T015 [US2] `decide.ts` (shared with Slice 3), the Chore body in `issue-body.ts`, `markReady` in `actions.ts`, `useDecide` in `queries.ts`
- [ ] T016 [US2] `decide-sheet.tsx` and It's ready on the card

**Checkpoint**: `pnpm validate` passes.

---

## Slice 3: User Story 3 - Remove it (Priority: P3)

**Goal**: Remove it: the feature-removal Chore, then Removed.

**Covers**: US3.1–US3.3, FR-006 (remove)

**Behind Toggle**: `feature-114`

### Tests (write first, see them fail)

- [ ] T017 [P] [US3] Vitest: `decide` with Remove: the removal Chore's title and body (drop the feature's tables in its migration), Removed, and the same rollbacks, in `decide.test.ts`
- [ ] T018 [US3] Playwright: `liv` removes a request's feature and sees Removed, in `e2e/feature-requests.spec.ts`

### Implementation

- [ ] T019 [US3] `removeFeature` in `actions.ts`, and Remove it on the card with its confirm sheet

**Checkpoint**: `pnpm validate` passes.

---

## Slice 4: User Story 4 - A reminder to decide (Priority: P4)

**Goal**: one reminder per Round after 14 days in Testing.

**Covers**: US4.1–US4.3, FR-007

**Behind Toggle**: `feature-114`

### Tests (write first, see them fail)

- [ ] T020 [P] [US4] pgTAP: who is due, once per Round, and nobody Live, Removed, withdrawn or under 14 days, in `supabase/tests/database/024_testing_reminders.test.sql`
- [ ] T021 [P] [US4] Vitest: the reminder's title, body and URL, and `reminded` in the response, in `sync-handler.test.ts`

### Implementation

- [ ] T022 [US4] Migration `pnpm db:new testing_reminders`, then `pnpm db:reset && pnpm db:types`
- [ ] T023 [US4] Reminders in `sync-handler.ts` and the sync route

**Checkpoint**: `pnpm validate` passes.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Give feedback, and get another Round | US1.1–US1.11 | T001–T010 | — | Yes (RLS, `can_try_toggle`, Feature template and `/deliver`) |
| 2 | Mark it ready | US2.1–US2.4 | T011–T016 | Slice 1 | Yes (a Requester turns a feature on for everyone, irreversibly) |
| 3 | Remove it | US3.1–US3.3 | T017–T019 | Slice 2 | Yes (turns a feature off for everyone; its Chore drops tables) |
| 4 | A reminder to decide | US4.1–US4.3 | T020–T023 | Slice 1 | No |
