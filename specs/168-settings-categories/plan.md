# Implementation Plan: Settings in categories

**Spec**: [spec.md](./spec.md) | **Spec issue**: #168 | **Date**: 2026-11-09

## Summary

Add three routes under `/settings` (tracking, preferences, features). A client `SettingsLayout` component reads Toggle `feature-167`. Where on, `/settings` renders category rows plus About and Account; where off, loading or failed it renders today's list. Existing section components are reused unchanged.

## Technical Context

- **Stack**: Next.js App Router (read `node_modules/next/dist/docs/` before adding routes), React, shadcn/ui, Tailwind 4
- **New dependencies**: none
- **Data**: one migration inserting Toggle `feature-167` in Testing (Slice 1)
- **Server boundaries**: none
- **New environment variables**: none
- **Query keys**: none new; Toggles use `toggleKeys` (spec 116)
- **Screens and states**: Settings hub (category rows), three category pages with a back link. Hub falls back to the single list while Toggles load or fail.

## Constitution Check

- [x] I. No new term; "Settings category" is described in the spec only, so `CONTEXT.md` gains it in this pull request
- [x] II. Every scenario has a test below
- [x] III. Behind `feature-167`
- [x] IV. The migration is an insert, safe with the deployed app
- [x] V. No secret
- [x] VI. Rows 44 px, Australian English
- [x] VII. Risk assessment holds

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Testing Library, Playwright | `src/features/settings/settings-categories.test.tsx`, `e2e/settings-categories.spec.ts` |
| US1.2 | Testing Library | `src/features/settings/settings-categories.test.tsx` |
| US1.3 | Playwright | `e2e/settings-categories.spec.ts` |
| US1.4 | Playwright | `e2e/settings-categories.spec.ts` |
| US1.5 | Playwright | `e2e/settings-categories.spec.ts` |
| US1.6 | Playwright | `e2e/settings-categories.spec.ts` |
| US1.7 | Testing Library | `src/features/settings/settings-categories.test.tsx` |
| US1.8 | Testing Library, Playwright | `src/features/settings/settings-categories.test.tsx`, `e2e/settings-categories.spec.ts` |
| US1.9 | Testing Library | `src/features/settings/settings-categories.test.tsx` |

## Migration Plan

1. **Slice 1, `toggle_settings_categories`**: inserts Toggle `feature-167` in Testing, titled "Organise Settings into categories." (`on conflict do nothing`). Safe with the deployed app.

## Project Structure

```text
specs/168-settings-categories/
├── spec.md, plan.md, tasks.md
src/features/settings/categories.ts          # category definitions
src/features/settings/settings-categories.tsx # hub + gate, with *.test.tsx
src/app/(app)/settings/{tracking,preferences,features}/page.tsx
src/app/(app)/settings/page.tsx              # uses the gate
supabase/migrations/<timestamp>_toggle_settings_categories.sql
e2e/settings-categories.spec.ts
```
