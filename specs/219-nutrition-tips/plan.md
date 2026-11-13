# Implementation Plan: Nutrition tips for last week

**Spec**: [spec.md](./spec.md) | **Spec issue**: #219 | **Date**: 2026-11-13

## Summary

Where Toggle `feature-218` is on, Summary ends with a **Nutrition tips** card for last week. **Get tips** posts the week's first Day to `POST /api/nutrition-tips`, which checks the Toggle, the week and the daily allowance, sums the week's Entries per Food with the User's own client, and asks Gemini (light model, JSON schema) for up to three tips. Slice 2 keeps each week's set in a new RLS table so reopening is free and **Ask again** replaces it.

## Technical Context

- **Stack**: Next.js App Router, React, TanStack Query, shadcn/ui, Tailwind 4, Supabase, `@google/genai` through `src/lib/gemini.ts`
- **New dependencies**: none
- **Data**: Slice 1: a migration adding Toggle `feature-218` (Testing). Slice 2: table `public.nutrition_tips` with RLS ([data-model.md](./data-model.md))
- **Server boundaries**: route handler `src/app/api/nutrition-tips/route.ts` (POST), with the logic in `src/features/nutrition-tips/tips-handler.ts` behind injected deps, as `guess-handler.ts` does. `GEMINI_API_KEY` stays server-side ([contracts.md](./contracts.md))
- **New environment variables**: `NUTRITION_TIPS=fake`, test-only, in `playwright.config.ts`'s web server env. No production variable
- **Query keys**: `nutritionTipKeys` in `src/features/nutrition-tips/queries.ts`: `all`, `week(from)` (Slice 2 reads the kept set). The card reuses `useDailyTotals` for the Logged Days check
- **Screens and states**: the card on `summary-screen.tsx`: not enough Days; ready (**Get tips**); working; tips (with **Ask again** in Slice 2); limit reached; unavailable; failed or offline (**Try again**). Toggle off, loading or failed: no card

## Constitution Check

- [x] I. New term **Nutrition tip** added to `CONTEXT.md` in this pull request
- [x] II. Every scenario has a test below
- [x] III. Slice 1 adds `feature-218`; both Slices gate on it (`useToggle` in the card, `isToggleOn` in the route)
- [x] IV. Additive migrations (a Toggle row; a new table); nothing reads them in the deployed app. Daily Totals untouched
- [x] V. `GEMINI_API_KEY` is read only in the route handler's module graph
- [x] VI. 44 px buttons, Australian English
- [x] VII. Risk assessment holds: Gemini use and unprovable output (Slice 1), RLS table (Slice 2)

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Testing Library, Playwright | `src/features/nutrition-tips/tips-card.test.tsx`, `e2e/nutrition-tips.spec.ts` |
| US1.2 | Testing Library, Vitest | `src/features/summary/summary-screen.test.tsx`, `src/features/nutrition-tips/tips-handler.test.ts` |
| US1.3 | Vitest, Testing Library | `src/features/nutrition-tips/week.test.ts`, `tips-handler.test.ts`, `tips-card.test.tsx` |
| US1.4 | Vitest, Testing Library, Playwright | `src/features/nutrition-tips/week.test.ts`, `src/features/nutrition-tips/gemini-tips-writer.test.ts`, `tips-card.test.tsx`, `e2e/nutrition-tips.spec.ts` |
| US1.5 | Vitest | `tips-handler.test.ts` |
| US1.6 | Vitest | `gemini-tips-writer.test.ts` |
| US1.7 | Vitest, Testing Library | `tips-handler.test.ts`, `tips-card.test.tsx` |
| US1.8 | Vitest, Testing Library | `tips-handler.test.ts`, `tips-card.test.tsx` |
| US1.9 | Vitest | `tips-handler.test.ts` |
| US1.10 | Testing Library | `src/features/settings/about-section.test.tsx` |
| US2.1 | Testing Library, Playwright | `tips-card.test.tsx`, `e2e/nutrition-tips.spec.ts` |
| US2.2 | Vitest, Testing Library | `tips-handler.test.ts`, `tips-card.test.tsx` |
| US2.3 | Testing Library | `tips-card.test.tsx` |
| US2.4 | pgTAP | `supabase/tests/database/nutrition_tips.test.sql` |
| US2.5 | pgTAP | `supabase/tests/database/nutrition_tips.test.sql` |
| US2.6 | Testing Library | `tips-card.test.tsx` |

## Migration Plan

1. **Slice 1, `toggle_nutrition_tips`**: `insert into public.toggles (key, title) values ('feature-218', 'Nutrition tips for last week.') on conflict do nothing;`. Testing by default; the deployed app ignores unknown Toggles.
2. **Slice 2, `nutrition_tips`**: creates `public.nutrition_tips` with RLS and owner-only policies. A new table the deployed app never reads.

## Project Structure

```text
specs/219-nutrition-tips/
├── spec.md, plan.md, data-model.md, contracts.md, tasks.md
src/app/api/nutrition-tips/route.ts              # POST; wires the handler to Supabase, isToggleOn and the writer
src/features/nutrition-tips/week.ts              # last week's range, the 3-Logged-Day check, the per-Food summary sent to Gemini
src/features/nutrition-tips/tips-handler.ts      # checks, allowance, tidy-up, TipsWriter interface, FakeTipsWriter, getTipsWriter
src/features/nutrition-tips/gemini-tips-writer.ts# system prompt and answer schema
src/features/nutrition-tips/tips-card.tsx        # the card and its states
src/features/nutrition-tips/queries.ts           # nutritionTipKeys, useKeptTips (Slice 2), useGetTips mutation
src/features/summary/summary-screen.tsx          # renders the card behind useToggle("feature-218")
src/features/settings/about-section.tsx          # Nutrition tips sentence while the Toggle is on
playwright.config.ts                             # NUTRITION_TIPS: "fake"
supabase/migrations/<ts>_toggle_nutrition_tips.sql, <ts>_nutrition_tips.sql
supabase/tests/database/nutrition_tips.test.sql
e2e/nutrition-tips.spec.ts
CONTEXT.md                                       # Nutrition tip (this Spec pull request)
```
