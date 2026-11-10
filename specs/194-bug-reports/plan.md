# Implementation Plan: Report a bug from inside the app

**Spec**: [spec.md](./spec.md) | **Spec issue**: #194 | **Date**: 2026-11-10

## Summary

A **Report a bug** form in Settings → Features sends a Bug report through a server action. The action checks the Toggle, the session and the fields, records a `bug_reports` row (which enforces 5 a day), reads the User's Toggles itself, and creates a Bug Issue with spec 124's GitHub client, quoting every User-written field. Slice 2 adds a device description the browser collects and the server trims to known fields. The Bug template and `bug.md` learn the two new headings.

## Technical Context

- **Stack**: Next.js (App Router, `node_modules/next` is newer than most training data), React, TanStack Query, shadcn/ui on Base UI, Tailwind, Supabase (Postgres with RLS) in Sydney, Vercel
- **New dependencies**: none (the user-agent fallback is a few regular expressions in `device.ts`, not a parser package)
- **Data**: [data-model.md](./data-model.md)
- **Server boundaries**: one server action, `sendBugReport` ([contracts.md](./contracts.md)); it uses `createFeatureIssues()` from spec 124 and the service-role client to write rows. No route handler
- **New environment variables**: none (`GITHUB_FEATURE_REQUESTS_TOKEN`, `FEATURE_ISSUES` and `COMMIT_SHA` exist)
- **Query keys**: `bugReportKeys` in `src/features/bug-reports/queries.ts` with `sentToday()` (the count of the User's reports in the last 24 hours, for the limit message); the preview reads `toggleKeys.mine()`
- **Screens and states**: `/settings/report-a-bug` (404 with the Toggle off): the form, its field errors, the public notice and Give feedback hint, **Attached to your report** (loading: "Checking…"; Toggles unreadable: "Couldn't be read"), sending (button disabled, "Sending…"), Sent (link to the Issue, fields cleared), the limit message, and the couldn't-send message keeping the text. Offline is the couldn't-send message

## Constitution Check

- [x] I. Bug report added to `CONTEXT.md`; Toggle, User, Owner, Appearance used as defined
- [x] II. Every acceptance scenario has a test at the right layer (below)
- [x] III. Slice 1 adds `feature-192` in Testing; the row, page and action check it
- [x] IV. One additive migration; Daily Totals untouched
- [x] V. The GitHub token stays in the server action; the browser sends only the User's fields and device
- [x] VI. The form is one column, its Send button at the bottom within thumb reach, radios and buttons at least 44 px; Australian English
- [x] VII. The Risk assessment holds

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Testing Library, Playwright | `src/features/settings/report-a-bug-row.test.tsx`, `e2e/bug-reports.spec.ts` |
| US1.2, FR-001 | Testing Library, Vitest, Playwright | `src/features/settings/report-a-bug-row.test.tsx`, `src/features/bug-reports/send.test.ts`, `e2e/bug-reports.spec.ts` |
| US1.3 | Vitest, Testing Library | `src/features/bug-reports/domain.test.ts`, `src/features/bug-reports/bug-report-form.test.tsx` |
| US1.4 | Testing Library | `src/features/bug-reports/bug-report-form.test.tsx` |
| US1.5 | Vitest, Testing Library | `src/features/bug-reports/issue-body.test.ts`, `src/features/bug-reports/bug-report-form.test.tsx` |
| US1.6 | Vitest, Playwright | `src/features/bug-reports/issue-body.test.ts`, `src/features/bug-reports/send.test.ts`, `e2e/bug-reports.spec.ts` |
| US1.7 | Vitest | `src/features/bug-reports/issue-body.test.ts`, `src/lib/issue-text.test.ts` |
| US1.8 | Testing Library, Playwright | `src/features/bug-reports/bug-report-form.test.tsx`, `e2e/bug-reports.spec.ts` |
| US1.9, FR-005 | pgTAP, Vitest, Testing Library | `supabase/tests/database/027_bug_reports.test.sql`, `src/features/bug-reports/send.test.ts`, `src/features/bug-reports/bug-report-form.test.tsx` |
| US1.10 | Vitest, Testing Library | `src/features/bug-reports/send.test.ts`, `src/features/bug-reports/bug-report-form.test.tsx` |
| US1.11, FR-006 | pgTAP | `supabase/tests/database/027_bug_reports.test.sql` |
| US1.12, FR-009 | Vitest | `scripts/workflow/bug-template.test.mjs` |
| US2.1 | Vitest | `src/features/bug-reports/device.test.ts` |
| US2.2 | Vitest | `src/features/bug-reports/device.test.ts` |
| US2.3 | Vitest, Testing Library | `src/features/bug-reports/device.test.ts`, `src/features/bug-reports/bug-report-form.test.tsx` |
| US2.4 | Vitest, Playwright | `src/features/bug-reports/issue-body.test.ts`, `e2e/bug-reports.spec.ts` |
| US2.5, FR-008 | Vitest | `src/features/bug-reports/device.test.ts` |
| US2.6 | Vitest | `src/features/bug-reports/send.test.ts` |

Playwright runs with the fake GitHub client (`FEATURE_ISSUES=fake`), which returns an Issue number but keeps no body, so the journeys prove the Sent state and the preview on a Pixel 7; the Issue body itself is proved in Vitest against `bugIssueBody` and `sendBugReport` with a recording fake.

## Migration Plan

1. **Slice 1, `bug_reports`**: inserts Toggle `feature-192` (Testing), creates `public.bug_reports` with RLS, its select policy and the 5-a-day trigger ([data-model.md](./data-model.md)). Nothing the deployed app reads changes, so it is safe before the app ships (ADR 0003).

Slice 2 has no migration.

## Project Structure

```text
specs/194-bug-reports/
├── spec.md, plan.md, data-model.md, contracts.md, tasks.md
src/
├── app/(app)/settings/report-a-bug/page.tsx       # 404 unless feature-192 is on
├── features/bug-reports/
│   ├── domain.ts           # parseBugReport, the field limits, SEVERITIES, SCREENS
│   ├── issue-body.ts       # bugIssueTitle, bugIssueBody, BUG_LABELS
│   ├── send.ts             # sendBugReport's logic, with its dependencies passed in
│   ├── actions.ts          # "use server": wires send.ts to Supabase and the GitHub client
│   ├── device.ts           # Slice 2: describeDevice (browser), parseDevice (server)
│   ├── queries.ts          # bugReportKeys, useSentToday, useSendBugReport
│   └── bug-report-form.tsx # the form and Attached to your report
│   (each with its *.test.ts or *.test.tsx)
├── features/settings/report-a-bug-row.tsx          # the row, shown when feature-192 is on
├── features/settings/settings-categories.tsx       # adds the row to Features
└── lib/issue-text.ts                               # quote and neutralise, moved from feature-requests/issue-body.ts
.github/ISSUE_TEMPLATE/3-bug.yml                    # Toggles and Requested by fields
.claude/skills/deliver/bug.md                       # reads them
scripts/workflow/bug-template.test.mjs
supabase/migrations/<timestamp>_bug_reports.sql
supabase/tests/database/027_bug_reports.test.sql
e2e/bug-reports.spec.ts
```
