# Implementation Plan: Feature Requests from inside the app

**Spec**: [spec.md](./spec.md) | **Spec issue**: #124 | **Date**: 2026-11-08

## Summary

A `feature_requests` table holds each request, written only by the server and read by its Requester through RLS. A server action validates the form, creates the Feature Issue through a small GitHub client (faked in local and CI), and stores the Issue number. A new step in `board.yml` works out every request's stage from its Issue tree and POSTs it to a secret-guarded route, which stores it and sends the Reminder-style Web Push when a request becomes Ready to try or Not going ahead. Everything sits behind Toggle `feature-114`.

## Technical Context

- **Stack**: Next.js (App Router, `node_modules/next` is newer than most training data), React, TanStack Query, shadcn/ui on Base UI, Tailwind, Supabase (Postgres with RLS) in Sydney, Vercel
- **New dependencies**: none. GitHub is called with `fetch`; push uses the existing `web-push` sender; forms use the existing `zod`
- **Data**: [data-model.md](./data-model.md)
- **Server boundaries**: server actions `submitFeatureRequest` and `withdrawFeatureRequest`; route `POST /api/feature-requests/sync` ([contracts.md](./contracts.md)). `GITHUB_FEATURE_REQUESTS_TOKEN` and `FEATURE_REQUESTS_SYNC_SECRET` are server only
- **New environment variables**: `GITHUB_FEATURE_REQUESTS_TOKEN` (Vercel production), `FEATURE_REQUESTS_SYNC_SECRET` (Vercel production and the GitHub Actions secret of the same name), `FEATURE_ISSUES=fake` (Playwright `webServer.env`)
- **Query keys**: `featureRequestKeys` in `src/features/feature-requests/queries.ts`: `all: ["feature-requests"]`, `mine()`, `others()`, `ahead(id)`; a submit or withdraw invalidates `all`, and switching a request's Toggle also invalidates `toggleKeys.all`
- **Screens and states**:
  - Settings: a **Feature requests** row (a link, 48 px) shown only while `feature-114` is on.
  - `/settings/feature-requests`: the list (own requests, then "Others are asking for"), **Request a feature** fixed at the bottom within thumb reach. Loading: skeleton cards. Empty: "Nothing requested yet. What would make the app better for you?". Error: message and Retry. 404 while the Toggle is off.
  - `/settings/feature-requests/new`: the form. At the limit: the reason and a link back instead of the form. Submitting: the button shows progress and the fields stay. Error: a toast and the fields kept. 404 while the Toggle is off.

## Constitution Check

- [x] I. Feature Request and Requester added to `CONTEXT.md`; Toggle, Testing and Owner used as defined
- [x] II. Every acceptance scenario has a test at the right layer (below)
- [x] III. Slice 1 adds Toggle `feature-114`; every Slice gates on it, so with it off nothing changes for anyone
- [x] IV. Migrations add a table and functions; `can_try_toggle` is replaced with an answer that is the same for every User who has no Feature Request
- [x] V. Both secrets are read only in server actions and the route handler; nothing is `NEXT_PUBLIC_*`
- [x] VI. Rows and buttons at least 48 px, **Request a feature** at the bottom; Australian English
- [x] VII. The Risk assessment holds (integration, secrets, guardrails, RLS, Size L)

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Playwright | `e2e/feature-requests.spec.ts` |
| US1.2 | Testing Library, Playwright | `src/features/settings/feature-requests-row.test.tsx`, `e2e/feature-requests.spec.ts` |
| US1.3 | Vitest, Testing Library | `src/features/feature-requests/domain.test.ts`, `src/features/feature-requests/request-form.test.tsx` |
| US1.4 | Testing Library | `src/features/feature-requests/request-form.test.tsx` |
| US1.5 | Vitest, Playwright | `src/features/feature-requests/issue-body.test.ts`, `src/features/feature-requests/submit.test.ts`, `e2e/feature-requests.spec.ts` |
| US1.6 | Vitest | `src/features/feature-requests/issue-body.test.ts` |
| US1.7 | pgTAP, Testing Library | `supabase/tests/database/020_feature_requests.test.sql`, `src/features/feature-requests/request-form.test.tsx` |
| US1.8 | Testing Library | `src/features/feature-requests/request-form.test.tsx` |
| US1.9 | Vitest, Testing Library | `src/features/feature-requests/submit.test.ts`, `src/features/feature-requests/request-form.test.tsx` |
| US1.10 | pgTAP | `supabase/tests/database/020_feature_requests.test.sql` |
| US2.1 | Vitest | `scripts/workflow/feature-requests.test.mjs` |
| US2.2 | Vitest | `src/features/feature-requests/stage.test.ts` |
| US2.3 | Vitest | `src/features/feature-requests/sync-handler.test.ts` |
| US2.4 | pgTAP, Playwright | `supabase/tests/database/021_feature_request_sync.test.sql`, `e2e/feature-requests.spec.ts` |
| US2.5 | Testing Library | `src/features/feature-requests/request-card.test.tsx` |
| US2.6 | Testing Library | `src/features/feature-requests/request-list.test.tsx` |
| US3.1 | Vitest, pgTAP | `src/features/feature-requests/sync-handler.test.ts`, `supabase/tests/database/021_feature_request_sync.test.sql` |
| US3.2 | Vitest | `src/features/feature-requests/sync-handler.test.ts` |
| US3.3 | Vitest, pgTAP | `src/features/feature-requests/sync-handler.test.ts`, `supabase/tests/database/021_feature_request_sync.test.sql` |
| US3.4 | Vitest, Testing Library | `scripts/workflow/feature-requests.test.mjs`, `src/features/feature-requests/request-card.test.tsx` |
| US3.5 | pgTAP, Playwright | `supabase/tests/database/022_requester_toggles.test.sql`, `e2e/feature-requests.spec.ts` |
| US3.6 | pgTAP | `supabase/tests/database/022_requester_toggles.test.sql` |
| US3.7 | Review | `.claude/skills/deliver/spec.md`, `.specify/templates/overrides/spec-template.md` |
| US4.1 | Vitest, Playwright | `src/features/feature-requests/withdraw.test.ts`, `e2e/feature-requests.spec.ts` |
| US4.2 | Vitest, Testing Library | `src/features/feature-requests/stage.test.ts`, `src/features/feature-requests/request-card.test.tsx` |
| US4.3 | pgTAP | `supabase/tests/database/021_feature_request_sync.test.sql` |
| US4.4 | pgTAP | `supabase/tests/database/020_feature_requests.test.sql` |

## Migration Plan

1. **Slice 1, `feature_requests`**: the table, its RLS and limit trigger, and Toggle `feature-114` "Feature requests" in Testing. Nothing deployed reads them.
2. **Slice 2, `feature_request_sync`**: `other_feature_requests()`, `feature_requests_ahead()` and `apply_feature_request_sync()`. New functions only.
3. **Slice 3, `requester_toggles`**: `create or replace` of `can_try_toggle`, adding the Requester. For every User without a Feature Request it answers exactly as before, so the deployed app behaves the same.

After Slice 1 deploys, the Owner creates the fine-grained token and sets `GITHUB_FEATURE_REQUESTS_TOKEN` in Vercel production; after Slice 2, `FEATURE_REQUESTS_SYNC_SECRET` in Vercel production and as a GitHub Actions secret (`human-step`, steps in `scripts/setup-feature-requests.sh`).

## Project Structure

### Documentation (this feature)

```text
specs/124-feature-requests/
├── spec.md
├── plan.md
├── data-model.md
├── contracts.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/(app)/settings/page.tsx                        # FeatureRequestsRow
├── app/(app)/settings/feature-requests/
│   ├── page.tsx                                       # the list, 404 while the Toggle is off
│   ├── new/page.tsx                                   # the form, 404 while the Toggle is off
│   └── actions.ts                                     # submitFeatureRequest, withdrawFeatureRequest
├── app/api/feature-requests/sync/route.ts
├── features/feature-requests/
│   ├── domain.ts                                      # parseFeatureRequest, limits, open stages
│   ├── issue-body.ts                                  # title and body from the template headings
│   ├── feature-issues.ts                              # GitHub client and fake
│   ├── submit.ts, withdraw.ts                         # the actions' logic, testable without Next
│   ├── stage.ts                                       # labels, Live/Removed from the Toggle, can withdraw
│   ├── sync-handler.ts                                # the route's logic
│   ├── queries.ts                                     # featureRequestKeys and hooks
│   ├── request-form.tsx, request-list.tsx, request-card.tsx
│   └── *.test.ts(x)
└── features/settings/feature-requests-row.tsx
supabase/
├── migrations/<timestamp>_feature_requests.sql, _feature_request_sync.sql, _requester_toggles.sql
└── tests/database/020_feature_requests.test.sql, 021_feature_request_sync.test.sql, 022_requester_toggles.test.sql
scripts/
├── workflow/feature-requests.mjs, feature-requests.test.mjs, feature-requests-sync.mjs
└── setup-feature-requests.sh                          # the Owner's human steps
.github/
├── workflows/board.yml                                # the sync step
└── ISSUE_TEMPLATE/1-feature.yml                       # Additional details
.claude/skills/deliver/triage.md, spec.md               # Additional details; Ready to try section
.specify/templates/overrides/spec-template.md          # Ready to try section
e2e/feature-requests.spec.ts
playwright.config.ts                                   # FEATURE_ISSUES=fake, a test sync secret
```
