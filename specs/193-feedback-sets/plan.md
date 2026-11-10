# Implementation Plan: Several sets of feedback

**Spec**: [spec.md](./spec.md) | **Spec issue**: #193 | **Date**: 2026-11-10

## Summary

A Round gains an ordered list of sets, each text plus a category. The Give feedback sheet edits the list; `giveFeedback` validates it, starts the Round with a new function overload and builds one follow-up Feature Issue with a section per set. The card lists each Round's sets. Nothing else in spec 135 changes.

## Technical Context

- **Stack**: Next.js (App Router, `node_modules/next` is newer than most training data), React, TanStack Query, shadcn/ui on Base UI, Tailwind, Supabase (Postgres with RLS) in Sydney, Vercel
- **New dependencies**: none
- **Data**: [data-model.md](./data-model.md)
- **Server boundaries**: `giveFeedback` takes `sets` ([contracts.md](./contracts.md))
- **New environment variables**: none
- **Query keys**: none added; `featureRequestKeys.mine()` loads `sets` with each Round
- **Screens and states**: the Give feedback sheet shows a list of sets (text box, Enhancement/Bug radios, Remove), Add another set, and per-set error messages; Rounds on the card list sets with a category label.

## Constitution Check

- [x] I. Feedback set added to `CONTEXT.md`; Round, Toggle used as defined
- [x] II. Every acceptance scenario has a test at the right layer (below)
- [x] III. Everything stays behind `feature-114`
- [x] IV. The migration adds a nullable column and a function overload; the old app keeps working
- [x] V. No new secret
- [x] VI. Radios and buttons at least 44 px, the sheet at the bottom; Australian English
- [x] VII. The Risk assessment holds

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Testing Library | `src/features/feature-requests/feedback-sheet.test.tsx` |
| US1.2 | Testing Library | `src/features/feature-requests/feedback-sheet.test.tsx` |
| US1.3 | Testing Library | `src/features/feature-requests/feedback-sheet.test.tsx` |
| US1.4 | Testing Library | `src/features/feature-requests/feedback-sheet.test.tsx` |
| US1.5 | Vitest, Testing Library | `src/features/feature-requests/domain.test.ts`, `src/features/feature-requests/feedback-sheet.test.tsx` |
| US1.6 | Vitest, Playwright | `src/features/feature-requests/issue-body.test.ts`, `src/features/feature-requests/feedback.test.ts`, `e2e/feature-requests.spec.ts` |
| US1.7 | Vitest, Testing Library | `src/features/feature-requests/feedback.test.ts`, `src/features/feature-requests/feedback-sheet.test.tsx` |
| US1.8, FR-006 | Vitest, pgTAP | `src/features/feature-requests/feedback.test.ts`, `supabase/tests/database/026_feedback_sets.test.sql` |
| US1.9 | Vitest, Testing Library | `src/features/feature-requests/feedback.test.ts`, `src/features/feature-requests/feedback-sheet.test.tsx` |
| US2.1 | Testing Library | `src/features/feature-requests/request-card.test.tsx` |
| US2.2 | Testing Library | `src/features/feature-requests/request-card.test.tsx` |
| US2.3 | pgTAP | `supabase/tests/database/026_feedback_sets.test.sql` |

## Migration Plan

1. **Slice 1, `feedback_sets`**: `sets jsonb` (nullable, with its check) and the `start_feature_request_round(uuid, uuid, jsonb)` overload. The old function and column answers are untouched, so the deployed app is unaffected (ADR 0003).

## Project Structure

```text
specs/193-feedback-sets/
├── spec.md, plan.md, data-model.md, contracts.md, tasks.md
src/features/feature-requests/
├── domain.ts (parseSets), feedback.ts, feedback-sheet.tsx, issue-body.ts, queries.ts, request-card.tsx   # with *.test.ts(x)
supabase/migrations/<timestamp>_feedback_sets.sql
supabase/tests/database/026_feedback_sets.test.sql
e2e/feature-requests.spec.ts
```
