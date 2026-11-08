# Implementation Plan: Feedback, Ready and Remove for Feature Requests

**Spec**: [spec.md](./spec.md) | **Spec issue**: #135 | **Date**: 2026-11-08

## Summary

Feedback adds a Round: a row in `feature_request_rounds` and a follow-up Feature Issue whose `### Requested by` is the request's own id, so the existing sync only has to send the newest Feature Issue per request. It's ready and Remove it are server actions that create the clean-up Chore first and then move the Toggle out of Testing with the service role. A 14-day reminder rides on the sync route, which the board's nightly run calls.

## Technical Context

- **Stack**: Next.js (App Router, `node_modules/next` is newer than most training data), React, TanStack Query, shadcn/ui on Base UI, Tailwind, Supabase (Postgres with RLS) in Sydney, Vercel
- **New dependencies**: none
- **Data**: [data-model.md](./data-model.md)
- **Server boundaries**: server actions `giveFeedback`, `markReady` and `removeFeature`; the sync route gains reminders ([contracts.md](./contracts.md))
- **New environment variables**: none
- **Query keys**: none added: each request's Rounds load with it (`feature_request_rounds` embedded in `featureRequestKeys.mine()`); every action invalidates `featureRequestKeys.all`, and It's ready and Remove it also `toggleKeys.all`
- **Screens and states**: the Ready to try card gains **Give feedback** (a bottom sheet with a textarea, the public notice and the limit), **It's ready** and **Remove it** (bottom confirm sheets), and a list of Rounds. Each action shows progress, keeps its sheet's text on an error, and says what went wrong in a toast.

## Constitution Check

- [x] I. Round added to `CONTEXT.md`; Toggle, Live and Removed used as defined
- [x] II. Every acceptance scenario has a test at the right layer (below)
- [x] III. Everything stays behind `feature-114`; a Slice changes nothing for anyone without it
- [x] IV. Migrations add a table and columns, and replace functions with answers unchanged for requests with no Rounds
- [x] V. No new secret
- [x] VI. Buttons at least 44 px, sheets at the bottom; Australian English
- [x] VII. The Risk assessment holds

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Testing Library | `src/features/feature-requests/request-card.test.tsx` |
| US1.2 | Vitest, Testing Library | `src/features/feature-requests/feedback.test.ts`, `src/features/feature-requests/feedback-sheet.test.tsx` |
| US1.3 | Vitest, Playwright | `src/features/feature-requests/issue-body.test.ts`, `src/features/feature-requests/feedback.test.ts`, `e2e/feature-requests.spec.ts` |
| US1.4 | Vitest, pgTAP | `scripts/workflow/feature-requests.test.mjs` (`newestPerRequest`), `supabase/tests/database/023_feature_request_rounds.test.sql` |
| US1.5 | pgTAP | `supabase/tests/database/023_feature_request_rounds.test.sql` |
| US1.6 | pgTAP | `supabase/tests/database/023_feature_request_rounds.test.sql` |
| US1.7 | Vitest, Testing Library | `src/features/feature-requests/feedback.test.ts`, `src/features/feature-requests/feedback-sheet.test.tsx` |
| US1.8 | Vitest, Testing Library | `src/features/feature-requests/stage.test.ts` (`canDecide`), `src/features/feature-requests/request-card.test.tsx` |
| US1.9 | Vitest | `scripts/workflow/feature-template.test.mjs` (follow-up heading in the template, `triage.md` and `/deliver`'s `spec.md`) |
| US1.10 | pgTAP | `supabase/tests/database/023_feature_request_rounds.test.sql` |
| US1.11 | Vitest, Testing Library, Playwright | `src/features/feature-requests/stage.test.ts` (`canWithdraw`), `src/features/feature-requests/request-card.test.tsx`, `e2e/feature-requests.spec.ts`; the server's `markWithdrawn` update requires `first_ready_at is null` |
| US2.1 | Vitest, Playwright | `src/features/feature-requests/decide.test.ts`, `e2e/feature-requests.spec.ts` |
| US2.2 | Vitest | `src/features/feature-requests/decide.test.ts` |
| US2.3 | Vitest, pgTAP | `src/features/feature-requests/decide.test.ts`, `supabase/tests/database/019_toggles.test.sql` (state moves forward only) |
| US2.4 | Testing Library | `src/features/feature-requests/decide-sheet.test.tsx` |
| US3.1 | Vitest, Playwright | `src/features/feature-requests/decide.test.ts`, `e2e/feature-requests.spec.ts` |
| US3.2 | Vitest | `src/features/feature-requests/decide.test.ts` (the removal Chore's body) |
| US3.3 | Vitest | `src/features/feature-requests/decide.test.ts` |
| US4.1 | pgTAP, Vitest | `supabase/tests/database/024_testing_reminders.test.sql`, `src/features/feature-requests/sync-handler.test.ts` |
| US4.2 | pgTAP | `supabase/tests/database/024_testing_reminders.test.sql` |
| US4.3 | pgTAP | `supabase/tests/database/024_testing_reminders.test.sql` |

## Migration Plan

1. **Slice 1, `feature_request_rounds`**: the table, `first_ready_at` (set by a trigger the first time a request is Ready to try), `start_feature_request_round()`, and `create or replace` of `apply_feature_request_sync` and `can_try_toggle`. For requests without Rounds both answer as before, so the deployed app is unaffected. `first_ready_at` is backfilled from `stage_changed_at` for requests already at `ready_to_try`.
2. **Slice 2, `feature_request_decisions`**: `decision` and `cleanup_issue`. New nullable columns.
3. **Slice 4, `testing_reminders`**: `testing_reminder_sent_at` and `due_testing_reminders()`.

## Project Structure

```text
specs/135-feedback-ready-remove/
├── spec.md, plan.md, data-model.md, contracts.md, tasks.md
src/features/feature-requests/
├── feedback.ts, feedback-sheet.tsx, decide.ts, decide-sheet.tsx   # with *.test.ts(x)
├── issue-body.ts                       # followUpTo; Chore bodies
├── actions.ts, queries.ts, request-card.tsx, stage.ts, sync-handler.ts
app/api/feature-requests/sync/route.ts  # reminders
scripts/workflow/feature-requests.mjs, feature-requests-sync.mjs   # newest per request
supabase/migrations/<timestamp>_feature_request_rounds.sql, _feature_request_decisions.sql, _testing_reminders.sql
supabase/tests/database/023_feature_request_rounds.test.sql, 024_testing_reminders.test.sql
.github/ISSUE_TEMPLATE/1-feature.yml, .claude/skills/deliver/triage.md, .claude/skills/deliver/spec.md
e2e/feature-requests.spec.ts
```
