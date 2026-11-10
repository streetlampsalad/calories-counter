# Implementation Plan: Meal headings that stand out

**Spec**: [spec.md](./spec.md) | **Spec issue**: #187 | **Date**: 2026-11-10

## Summary

Restyle the Meal time group heading in `src/features/entries/entry-list.tsx` (larger, semibold, more space above), behind the existing Toggle `feature-173`. No data, dependency or Toggle changes.

## Technical Context

- **Stack**: Next.js App Router, React, Tailwind 4
- **New dependencies**: none
- **Data**: none; no migration
- **Server boundaries**: none
- **New environment variables**: none
- **Query keys**: unchanged
- **Screens and states**: the Day list headings; Toggle off, loading or failed render today's UI.

## Constitution Check

- [x] I. No new term
- [x] II. Every scenario has a test below
- [x] III. Behind `feature-173` (a Round adds no Toggle)
- [x] IV. No data change
- [x] V. No secret
- [x] VI. Copy unchanged; headings fit 360 px
- [x] VII. Risk assessment holds

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Playwright | `e2e/meal-times.spec.ts` |
| US1.2 | Testing Library | `src/features/entries/entry-list.test.tsx` |
| US1.3 | Testing Library | `src/features/entries/entry-list.test.tsx` |
| US1.4 | Testing Library | `src/features/entries/entry-list.test.tsx` |
| US1.5 | Playwright | `e2e/meal-times.spec.ts` |

## Project Structure

```text
specs/187-meal-heading-size/
├── spec.md, plan.md, tasks.md
src/features/entries/entry-list.tsx
src/features/entries/entry-list.test.tsx
e2e/meal-times.spec.ts
```
