# Implementation Plan: Meal times

**Spec**: [spec.md](./spec.md) | **Spec issue**: #174 | **Date**: 2026-11-09

## Summary

Add an optional `meal_time` to `entries`. Where Toggle `feature-173` is on, the picker and edit sheet show four chips, and the Day groups Entries by Meal time with computed subtotals. Everything gated; off, loading or failed is today's app.

## Technical Context

- **Stack**: Next.js App Router, React, TanStack Query, shadcn/ui, Tailwind 4
- **New dependencies**: none
- **Data**: one migration adding Toggle `feature-173` (Testing) and nullable `entries.meal_time` with a check constraint (Slice 1)
- **Server boundaries**: none
- **New environment variables**: none
- **Query keys**: unchanged (`entryKeys.day`); `ENTRY_SELECT` and `Entry` gain `mealTime`
- **Screens and states**: picker chips; Day list with group headings; edit sheet chips. Toggles loading or failed render today's UI.

## Constitution Check

- [x] I. New term **Meal time** is added to `CONTEXT.md` in this pull request
- [x] II. Every scenario has a test below
- [x] III. Behind `feature-173`
- [x] IV. Additive nullable column, safe with the deployed app; subtotals computed, not stored
- [x] V. No secret
- [x] VI. Chips 44 px, Australian English
- [x] VII. Risk assessment holds

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Testing Library | `src/features/entries/picker-sheet.test.tsx` |
| US1.2 | Vitest | `src/features/entries/meal-time.test.ts` |
| US1.3 | Testing Library | `src/features/entries/picker-sheet.test.tsx` |
| US1.4 | Testing Library, Playwright | `src/features/entries/mutations.test.tsx`, `e2e/meal-times.spec.ts` |
| US1.5 | Testing Library | `src/features/entries/mutations.test.tsx` |
| US1.6 | Testing Library | `src/features/entries/picker-sheet.test.tsx` |
| US1.7 | Testing Library | `src/features/entries/picker-sheet.test.tsx` |
| US1.8 | Testing Library | `src/features/entries/mutations.test.tsx` |
| US1.9 | pgTAP | `supabase/tests/database/entries-meal-time.test.sql` |
| US2.1 | Vitest, Playwright | `src/features/entries/meal-time.test.ts`, `e2e/meal-times.spec.ts` |
| US2.2 | Vitest | `src/features/entries/meal-time.test.ts` |
| US2.3 | Testing Library | `src/features/entries/entry-list.test.tsx` |
| US2.4 | Testing Library | `src/features/entries/entry-list.test.tsx` |
| US2.5 | Testing Library | `src/features/entries/entry-list.test.tsx` |
| US3.1 | Testing Library | `src/features/entries/edit-entry-sheet.test.tsx` |
| US3.2 | Testing Library, Playwright | `src/features/entries/edit-entry-sheet.test.tsx`, `e2e/meal-times.spec.ts` |
| US3.3 | Testing Library | `src/features/entries/edit-entry-sheet.test.tsx` |

## Migration Plan

1. **Slice 1, `toggle_meal_times`**: inserts Toggle `feature-173` in Testing, titled "Tag Entries with a Meal time." (`on conflict do nothing`), and `alter table public.entries add column meal_time text check (meal_time in ('breakfast','lunch','dinner','snack'))`. Nullable, so the deployed app's inserts and selects are unaffected.

## Project Structure

```text
specs/174-meal-times/
├── spec.md, plan.md, tasks.md
src/features/entries/meal-time.ts            # values, labels, default for the clock, grouping and subtotals
src/features/entries/meal-time-chips.tsx     # the chip row
src/features/entries/{today-screen,entry-rows,picker-sheet,edit-entry-sheet,entry-list,queries,types}.ts(x)
supabase/migrations/<timestamp>_toggle_meal_times.sql
supabase/tests/database/entries-meal-time.test.sql
e2e/meal-times.spec.ts
```
