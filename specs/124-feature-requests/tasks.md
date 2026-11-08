---
description: "Tasks for Feature Requests from inside the app"
---

# Tasks: Feature Requests from inside the app

**Input**: `spec.md`, `plan.md`, `data-model.md` and `contracts.md` in this folder.

**Spec issue**: #124

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - Ask for a feature (Priority: P1) 🎯 MVP

**Goal**: the Toggle, the table, the list, the form and creating the Feature Issue.

**Covers**: US1.1–US1.10, FR-001–FR-005 (own rows), FR-011

**Behind Toggle**: `feature-114` (added by this Slice's migration)

### Tests (write first, see them fail)

- [ ] T001 [P] [US1] pgTAP: own rows only, no writes through the API, the limit of 2 open, withdrawn not counted, in `supabase/tests/database/020_feature_requests.test.sql`. pgTAP runs in one session, so it proves the limit but not the per-User lock against two sessions at once; the lock is checked by reading the trigger in review
- [ ] T002 [P] [US1] Vitest: `parseFeatureRequest` limits; `issueTitle` and `issueBody` headings, `_Not given_` for an empty optional field, quoting, mention and cross-reference neutralising, in `src/features/feature-requests/domain.test.ts` and `issue-body.test.ts`
- [ ] T003 [P] [US1] Vitest: `submitFeatureRequest` logic with fakes: Toggle off, limit, GitHub failure deletes the row, a failure to store the number closes the Issue again, success stores the number, in `src/features/feature-requests/submit.test.ts`
- [ ] T004 [P] [US1] Testing Library: the form's validation, the gentle prompt, the public notice, the limit, notification offer, error keeps the text, in `src/features/feature-requests/request-form.test.tsx`; the Settings row in `src/features/settings/feature-requests-row.test.tsx`
- [ ] T004a [P] [US1] Vitest: `.github/ISSUE_TEMPLATE/1-feature.yml` has an `Additional details` field and `.claude/skills/deliver/triage.md` reads the `### Additional details` section, in `scripts/workflow/feature-template.test.mjs` (FR-011)
- [ ] T005 [US1] Playwright: `liv` with `feature-114` on submits a request and sees it Submitted; `cleo` sees no row and a 404, in `e2e/feature-requests.spec.ts`

### Implementation

- [ ] T006 [US1] Migration `pnpm db:new feature_requests` per `data-model.md` (table, RLS, limit trigger, Toggle `feature-114`), then `pnpm db:reset && pnpm db:types`
- [ ] T007 [P] [US1] `domain.ts`, `issue-body.ts`, `feature-issues.ts` (GitHub and fake) in `src/features/feature-requests/`
- [ ] T008 [US1] `submit.ts` and the server action in `src/app/(app)/settings/feature-requests/actions.ts`
- [ ] T009 [US1] `queries.ts`, `request-form.tsx`, `request-list.tsx` (own requests, Submitted), the two pages, and `FeatureRequestsRow` in Settings
- [ ] T010 [US1] `### Additional details` in `.github/ISSUE_TEMPLATE/1-feature.yml` and `.claude/skills/deliver/triage.md`; `FEATURE_ISSUES=fake` in `playwright.config.ts`; `GITHUB_FEATURE_REQUESTS_TOKEN` in `.env.example`; `scripts/setup-feature-requests.sh` (token step)

**Checkpoint**: `pnpm validate` passes. After deploy, the Owner sets `GITHUB_FEATURE_REQUESTS_TOKEN` in Vercel production (`human-step`).

---

## Slice 2: User Story 2 - Follow a request through its stages (Priority: P2)

**Goal**: the sync from GitHub, stages on the cards, others' requests.

**Covers**: US2.1–US2.6, FR-005 (others), FR-006

**Behind Toggle**: `feature-114`

### Tests (write first, see them fail)

- [ ] T011 [P] [US2] Vitest: `stageFor` on every Issue tree in US2.1 (including Submitted versus Being reviewed by `needs-triage` and assignee exactly as US2.1 states), Waiting for the owner winning per D5, and `latestComment`, and that the sync skips with a warning when the secret is missing or the route answers 404, in `scripts/workflow/feature-requests.test.mjs`
- [ ] T012 [P] [US2] pgTAP: `apply_feature_request_sync` updates by Feature Issue, ignores unknown Issues and withdrawn requests (US4.3); `other_feature_requests` hides who asked and stages outside Submitted–Ready to try; `feature_requests_ahead` only for the owner of the request; only `service_role` may sync, in `supabase/tests/database/021_feature_request_sync.test.sql`
- [ ] T013 [P] [US2] Vitest: the sync handler refuses a missing or wrong secret and a bad body, in `src/features/feature-requests/sync-handler.test.ts`
- [ ] T014 [P] [US2] Vitest and Testing Library: stage labels, Live and Removed from the Toggle, in `stage.test.ts`; the card's stage, comment and reason, in `request-card.test.tsx`; the list's loading, empty and error states, in `request-list.test.tsx`
- [ ] T015 [US2] Playwright: a sync moves `liv`'s request to Planning and the card says so; another User's in-progress request shows without a name, in `e2e/feature-requests.spec.ts`

### Implementation

- [ ] T016 [US2] Migration `pnpm db:new feature_request_sync` (three functions), then `pnpm db:reset && pnpm db:types`
- [ ] T017 [US2] `scripts/workflow/feature-requests.mjs` and `feature-requests-sync.mjs`; a "Sync Feature Requests" step in `.github/workflows/board.yml` (sparse checkout adds `specs`)
- [ ] T018 [US2] `sync-handler.ts` and `src/app/api/feature-requests/sync/route.ts`
- [ ] T019 [US2] `stage.ts`, `request-card.tsx`, "Others are asking for" in `request-list.tsx`, requests ahead
- [ ] T020 [US2] `FEATURE_REQUESTS_SYNC_SECRET` in `.env.example`, `playwright.config.ts` (a test value) and `scripts/setup-feature-requests.sh`

**Checkpoint**: `pnpm validate` passes. After deploy, the Owner sets `FEATURE_REQUESTS_SYNC_SECRET` in Vercel production and GitHub Actions (`human-step`).

---

## Slice 3: User Story 3 - Hear it's ready, and try it (Priority: P3)

**Goal**: notifications, the Ready to try note and the Requester's switch.

**Covers**: US3.1–US3.7, FR-007, FR-008, FR-010

**Behind Toggle**: `feature-114`

### Tests (write first, see them fail)

- [ ] T021 [P] [US3] pgTAP: `apply_feature_request_sync` returns a request only on the change into Ready to try or Not going ahead, in `021_feature_request_sync.test.sql`; the Requester (at Ready to try, not withdrawn) and the Owner can switch the Toggle and nobody else, nor the Requester at an earlier stage, in `supabase/tests/database/022_requester_toggles.test.sql`
- [ ] T022 [P] [US3] Vitest: the handler sends one push per device with the right title and URL, deletes expired subscriptions, sends nothing on other stages, in `sync-handler.test.ts`; `readyNote` reads the section, in `feature-requests.test.mjs`
- [ ] T023 [P] [US3] Testing Library: the note and the switch on a Ready to try card, in `request-card.test.tsx`
- [ ] T023a [P] [US3] Vitest: the spec template and `.claude/skills/deliver/spec.md` have the `## Ready to try` heading, and every `specs/<n>-*/spec.md` with `n` ≥ 124 has a non-empty section, in `scripts/workflow/ready-to-try.test.mjs` (US3.7)
- [ ] T024 [US3] Playwright: a sync to Ready to try shows the note, and `liv` turns the switch on, in `e2e/feature-requests.spec.ts`

### Implementation

- [ ] T025 [US3] Migration `pnpm db:new requester_toggles` (replace `can_try_toggle`), then `pnpm db:reset && pnpm db:types`
- [ ] T026 [US3] Notifications in `sync-handler.ts` and the route; `readyNote` in the sync script
- [ ] T027 [US3] The note and switch in `request-card.tsx` (with `useSwitchToggle`)
- [ ] T028 [US3] A `## Ready to try` section in `.specify/templates/overrides/spec-template.md`, and a step for it in `.claude/skills/deliver/spec.md`

**Checkpoint**: `pnpm validate` passes, and the Owner checks one real request end to end on their phone.

---

## Slice 4: User Story 4 - Withdraw a request (Priority: P4)

**Goal**: withdrawing before building starts.

**Covers**: US4.1–US4.4, FR-009 (US4.3 is proved by T012 in Slice 2, US4.4 by T001 in Slice 1)

**Behind Toggle**: `feature-114`

### Tests (write first, see them fail)

- [ ] T029 [P] [US4] Vitest: `withdrawFeatureRequest` logic: allowed stages, sets `withdrawn_at` before closing both Issues with the comment, clears it again if GitHub fails, refuses others, including a request a sync moved to Building after the screen loaded, in `src/features/feature-requests/withdraw.test.ts`; `canWithdraw` in `stage.test.ts`
- [ ] T030 [P] [US4] Testing Library: Withdraw and its confirm dialog only at allowed stages; Withdrawn shown, in `request-card.test.tsx`
- [ ] T031 [US4] Playwright: `liv` withdraws a Submitted request and it shows Withdrawn, in `e2e/feature-requests.spec.ts`

### Implementation

- [ ] T032 [US4] `withdraw.ts` and `withdrawFeatureRequest` in `actions.ts`
- [ ] T033 [US4] Withdraw and the confirm dialog in `request-card.tsx`

**Checkpoint**: `pnpm validate` passes.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Ask for a feature | US1.1–US1.10 | T001–T010 (with T004a) | — | Yes (GitHub token, RLS, Feature template) |
| 2 | Follow a request through its stages | US2.1–US2.6 | T011–T020 | Slice 1 | Yes (sync secret, `board.yml`, others' requests) |
| 3 | Hear it's ready, and try it | US3.1–US3.7 | T021–T028 (with T023a) | Slice 2 | Yes (Toggle access, `/deliver`, real push) |
| 4 | Withdraw a request | US4.1–US4.4 | T029–T033 | Slice 2 | No |
