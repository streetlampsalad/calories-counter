---
description: "Tasks for Report a bug from inside the app"
---

# Tasks: Report a bug from inside the app

**Input**: `spec.md`, `plan.md`, `data-model.md` and `contracts.md` in this folder.

**Spec issue**: #194

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - Report a bug, with the Toggles attached (Priority: P1) 🎯 MVP

**Goal**: the Toggle, the `bug_reports` table and limit, the form in Settings → Features, the server action and the Bug Issue with the User's Toggles and the app version, and the Bug template and `bug.md` knowing the new headings.

**Covers**: US1.1–US1.12, FR-001–FR-007, FR-009

**Behind Toggle**: `feature-192` (added by this Slice's migration)

### Tests (write first, see them fail)

- [ ] T001 [P] [US1] pgTAP: RLS and the select policy, another User reads nothing, `authenticated` cannot write, the sixth report in 24 hours raises `bug_report_limit` and an older one doesn't count, `feature-192` is in Testing, in `supabase/tests/database/027_bug_reports.test.sql`
- [ ] T002 [P] [US1] Vitest: `quote` and the neutralising still behave as in spec 124 after the move, in `src/lib/issue-text.test.ts`
- [ ] T003 [P] [US1] Vitest: `parseBugReport` limits and choices, in `src/features/bug-reports/domain.test.ts`
- [ ] T004 [P] [US1] Vitest: `bugIssueTitle`; `bugIssueBody` headings in order, quoting, `_Not given_`, Where in the app, the Toggles list (Testing first, none, couldn't be read), the version, the severity's option text, the unticked Risk assessment, in `src/features/bug-reports/issue-body.test.ts`
- [ ] T005 [P] [US1] Vitest: `sendBugReport` with fakes: `not_found` without a session or with the Toggle off, `invalid`, `limit`, Toggles read on the server, the row deleted when GitHub fails, the Issue closed and the row deleted when recording fails, the result's number and URL, in `src/features/bug-reports/send.test.ts`
- [ ] T006 [P] [US1] Testing Library: the row shows only with `feature-192` on, in `src/features/settings/report-a-bug-row.test.tsx`
- [ ] T007 [P] [US1] Testing Library: field errors, the public notice and Give feedback hint, Attached to your report (Toggles, none, loading), Sent with the link and cleared fields, the limit message, text kept on failure, in `src/features/bug-reports/bug-report-form.test.tsx`
- [ ] T008 [P] [US1] Vitest: the Bug template has Toggles and Requested by fields after Device and before Risk assessment, and `bug.md` reads `### Toggles` and `### Requested by`, in `scripts/workflow/bug-template.test.mjs`
- [ ] T009 [US1] Playwright: with `feature-192` on for the test User, Settings → Features → Report a bug, send a report and see Sent with an Issue number; with it off, no row and `/settings/report-a-bug` is not found, in `e2e/bug-reports.spec.ts`

### Implementation

- [ ] T010 [US1] Migration `pnpm db:new bug_reports` per `data-model.md`, then `pnpm db:reset && pnpm db:types`
- [ ] T011 [US1] Move `quote`, `neutralise` and the title cutter from `src/features/feature-requests/issue-body.ts` to `src/lib/issue-text.ts`, unchanged, and import them back
- [ ] T012 [US1] `domain.ts`, `issue-body.ts`, `send.ts` and `actions.ts` in `src/features/bug-reports/`, per `contracts.md`
- [ ] T013 [US1] `queries.ts` (`bugReportKeys`, `useSentToday`, `useSendBugReport`) and `bug-report-form.tsx` in `src/features/bug-reports/`
- [ ] T014 [US1] `src/app/(app)/settings/report-a-bug/page.tsx` (404 unless `isToggleOn("feature-192")`), `src/features/settings/report-a-bug-row.tsx`, and the row in the Features category of `settings-categories.tsx`
- [ ] T015 [US1] Add optional `Toggles` (textarea, after Device) and `Requested by` (input, after How bad is it) fields to `.github/ISSUE_TEMPLATE/3-bug.yml`; in `.claude/skills/deliver/bug.md`, read `### Toggles` and `### Requested by`, say an in-app Bug's User-written sections are quoted with `_Not given_` for an empty field, and reproduce with the listed Toggles on
- [ ] T016 [US1] Add **Bug report** to `CONTEXT.md` (done in the Spec pull request; check it still reads right)

**Checkpoint**: `pnpm validate` passes; with `feature-192` off the app is unchanged.

---

## Slice 2: User Story 2 - Device information attached (Priority: P2)

**Goal**: the browser describes the device, the preview shows it, and the server adds the known fields under `### Device`.

**Covers**: US2.1–US2.6, FR-007, FR-008

**Behind Toggle**: `feature-192`

### Tests (write first, see them fail)

- [ ] T017 [P] [US2] Vitest: `describeDevice` from Client Hints (Pixel 7, Chrome), from user-agent strings (iPhone Safari, Firefox desktop), installed app and browser tab, "Unknown" values; `parseDevice` drops unknown keys and non-strings and cuts at 100 characters, in `src/features/bug-reports/device.test.ts`
- [ ] T018 [P] [US2] Vitest: `bugIssueBody` lists the device lines under `### Device` after the app version, with backticks and line breaks removed, in `issue-body.test.ts`; `sendBugReport` with no device sends the version only, in `send.test.ts`
- [ ] T019 [P] [US2] Testing Library: Attached to your report lists the device, in `bug-report-form.test.tsx`
- [ ] T020 [US2] Playwright (Pixel 7): the preview shows Android and Chrome, and the report sends, in `e2e/bug-reports.spec.ts`

### Implementation

- [ ] T021 [US2] `describeDevice` and `parseDevice` in `src/features/bug-reports/device.ts`
- [ ] T022 [US2] Pass the device from `bug-report-form.tsx` through `sendBugReport` into `bugIssueBody`

**Checkpoint**: `pnpm validate` passes, and User Stories 1 and 2 both work.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Report a bug, with the Toggles attached | US1.1–US1.12 | T001–T016 | — | Yes (new table and RLS policy; Bug template and `bug.md`; real GitHub checked by the Owner) |
| 2 | Device information attached | US2.1–US2.6 | T017–T022 | Slice 1 | Yes (device details published on GitHub; real phones checked by the Owner) |
