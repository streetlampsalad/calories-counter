# Implementation Plan: Dark mode

**Spec**: [spec.md](./spec.md) | **Spec issue**: #147 | **Date**: 2026-11-08

## Summary

Mount `next-themes`' `ThemeProvider` in the root layout so it sets the `dark` class the stylesheet already defines, saved in `localStorage`, with `defaultTheme="light"`. A new "Appearance" section in Settings (behind Toggle `feature-146`) lets the User pick Light, Dark or System. The provider's inline script (present from Slice 1) applies a saved choice before first paint; once Toggles load off, the saved choice is cleared. Slice 2 proves the no-flash behaviour and adds the `theme-color` meta and dark toasts.

## Technical Context

- **Stack**: Next.js (App Router; read `node_modules/next/dist/docs/` before touching the root layout), React, shadcn/ui on Base UI, Tailwind 4 (`@custom-variant dark`), `next-themes` 0.4 (already installed)
- **New dependencies**: none
- **Data**: none in the app tables. One migration inserts the Toggle row `feature-146` in Testing (Slice 1)
- **Server boundaries**: none
- **New environment variables**: none
- **Query keys**: none (the choice is browser-only; the Toggle uses `toggleKeys` from spec 116)
- **Screens and states**: Settings gains "Appearance" (a three-option radio group, options at least 44 px high, current choice selected); hidden while Toggles load, fail or the Toggle is off. No loading, empty or error state of its own: a failed save keeps the visit's choice.

## Constitution Check

- [x] I. No new glossary term beyond Appearance, used only in this spec
- [x] II. Every acceptance scenario has a test at the right layer (below)
- [x] III. The "Appearance" section is behind `feature-146`; the first Slice adds the Toggle (see D4 for why applying a saved choice is not gated)
- [x] IV. The only migration is an insert, safe with the deployed app
- [x] V. No secret
- [x] VI. Options at least 44 px, Australian English
- [x] VII. The Risk assessment holds

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Testing Library | `src/features/settings/appearance-section.test.tsx` |
| US1.2 | Testing Library | `src/features/settings/appearance-section.test.tsx` |
| US1.3 | Testing Library, Playwright | `src/features/settings/appearance-section.test.tsx`, `e2e/appearance.spec.ts` |
| US1.4 | Testing Library, Playwright | `src/features/settings/appearance-section.test.tsx`, `e2e/appearance.spec.ts` |
| US1.5 | Playwright | `e2e/appearance.spec.ts` (emulated colour scheme, changed while open) |
| US1.6 | Playwright | `e2e/appearance.spec.ts` |
| US1.7 | Vitest | `src/lib/appearance.test.ts` (storage that throws) |
| US1.9 | Testing Library | `src/features/settings/appearance-section.test.tsx` (a cleanup component clears the saved choice once Toggles load off, and not on a failed load) |
| US1.8 | Playwright | `e2e/appearance.spec.ts` (a second browser context starts Light) |
| US2.1 | Playwright | `e2e/appearance.spec.ts` (background colour read before hydration) |
| US2.2 | Vitest, Playwright | `src/lib/appearance.test.ts` (`themeColor`), `e2e/appearance.spec.ts` |
| US2.3 | Testing Library | `src/components/ui/sonner.test.tsx` |
| US2.4 | Playwright | `e2e/appearance.spec.ts` (nothing saved: unchanged page, colour and toast) |

## Migration Plan

1. **Slice 1, `toggle_dark_mode`**: inserts the Toggle `feature-146` in Testing, titled "I want to be able to toggle the app into dark mode." (`on conflict do nothing`). Safe with the deployed app, which does not know the key.

## Project Structure

```text
specs/147-dark-mode/
├── spec.md, plan.md, tasks.md
src/lib/appearance.ts                        # choices, parse, themeColor; *.test.ts
src/app/providers.tsx, layout.tsx            # ThemeProvider
src/features/settings/appearance-section.tsx # with *.test.tsx
src/app/(app)/settings/page.tsx              # mounts it
supabase/migrations/<timestamp>_toggle_dark_mode.sql
e2e/appearance.spec.ts
```
