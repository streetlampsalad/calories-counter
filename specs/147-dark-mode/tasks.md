---
description: "Tasks for Dark mode"
---

# Tasks: Dark mode

**Input**: `spec.md` and `plan.md` in this folder.

**Spec issue**: #147

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - Choose Light, Dark or System in Settings (Priority: P1) 🎯 MVP

**Goal**: the Toggle, the provider, the "Appearance" section, and any screen fixed so it reads well in Dark.

**Covers**: US1.1–US1.9, FR-001–FR-004, FR-007–FR-009

**Behind Toggle**: `feature-146`

### Tests (write first, see them fail)

- [x] T001 [P] [US1] Vitest: parsing the saved choice (unknown or missing is Light) and storage that throws, in `src/lib/appearance.test.ts`
- [x] T002 [P] [US1] Testing Library: the section's three options, the selected one, hidden when the Toggle is off, loading or failed; the saved choice cleared once Toggles load off and kept on a failed load, in `src/features/settings/appearance-section.test.tsx`
- [x] T003 [US1] Playwright: Dark applies at once and after a reload, System follows the emulated scheme and its change, Light returns, a second context starts Light, in `e2e/appearance.spec.ts`

### Implementation

- [x] T004 [US1] Migration `pnpm db:new toggle_dark_mode` inserting the Toggle, then `pnpm db:reset && pnpm db:types`
- [x] T005 [US1] `src/lib/appearance.ts` and `ThemeProvider` in `src/app/providers.tsx` (`attribute="class"`, `defaultTheme="light"`, `enableSystem`, `disableTransitionOnChange`)
- [x] T006 [US1] `AppearanceSection` gated with `useToggle("feature-146")`, mounted in the Settings page, plus clearing a saved choice once Toggles have loaded off
- [ ] T007 [US1] Check each screen and sheet in Dark with Playwright screenshots and fix colours that are not variables

**Checkpoint**: `pnpm validate` passes.

---

## Slice 2: User Story 2 - Dark from the first frame, and in the phone's own chrome (Priority: P2)

**Goal**: no white flash, a matching theme colour, and dark toasts.

**Covers**: US2.1–US2.4, FR-005, FR-006

**Behind Toggle**: `feature-146`

### Tests (write first, see them fail)

- [ ] T008 [P] [US2] Vitest: `themeColor` for each resolved theme, in `src/lib/appearance.test.ts`
- [ ] T009 [P] [US2] Testing Library: the toaster uses the resolved theme, in `src/components/ui/sonner.test.tsx`
- [ ] T010 [US2] Playwright: Dark saved gives a dark background before hydration, the theme colour matches, and nothing saved leaves page, colour and toast unchanged, in `e2e/appearance.spec.ts`

### Implementation

- [ ] T011 [US2] The `theme-color` meta driven by the resolved theme, in `src/app/layout.tsx` (the pre-paint script and `suppressHydrationWarning` arrive with the provider in Slice 1; this Slice proves them with T010)
- [ ] T012 [US2] Sonner follows the resolved theme

**Checkpoint**: `pnpm validate` passes and User Stories 1 and 2 both work.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Choose Light, Dark or System in Settings | US1.1–US1.9 | T001–T007 | — | No |
| 2 | Dark from the first frame, and in the phone's own chrome | US2.1–US2.4 | T008–T012 | Slice 1 | No |
