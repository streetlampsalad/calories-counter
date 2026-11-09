---
description: "Tasks for Meal times"
---

# Tasks: Meal times

**Input**: `spec.md` and `plan.md` in this folder.

**Spec issue**: #174

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - Tag an Entry with a Meal time when adding it (Priority: P1) 🎯 MVP

**Goal**: the Toggle, the `meal_time` column, the chips in the picker and the tag saved and shown on the Entry row.

**Covers**: US1.1–US1.9, FR-001, FR-002, FR-005, FR-006, FR-007

**Behind Toggle**: `feature-173`

### Tests (write first, see them fail)

- [ ] T001 [P] [US1] Vitest: Meal time values and the clock default, in `src/features/entries/meal-time.test.ts`
- [ ] T002 [P] [US1] Testing Library: chips, default, toggling, saved value, optimistic rollback, kept on edit, in `picker-sheet.test.tsx` and `mutations.test.tsx`, including Undo after removing restoring the Meal time
- [ ] T003 [P] [US1] pgTAP: check constraint and nullable, in `supabase/tests/database/entries-meal-time.test.sql`
- [ ] T004 [US1] Playwright: add an Entry with a chosen Meal time, in `e2e/meal-times.spec.ts`

### Implementation

- [ ] T005 [US1] Migration `pnpm db:new toggle_meal_times`, then `pnpm db:reset && pnpm db:types`
- [ ] T006 [US1] `meal-time.ts`, `meal-time-chips.tsx`; `mealTime` on `Entry`, `ENTRY_SELECT`, `toRow` (so add, Undo and bulk add all write `meal_time`)
- [ ] T007 [US1] Chips in the picker (`FoodPickerSheet` gains a `day` prop and `onPick` gains `mealTime`; `today-screen.tsx` `log()` passes them) and the tag on the Entry row, gated by `useToggle("feature-173")`
- [ ] T008 [US1] Keep the `CONTEXT.md` term **Meal time** (added in the Spec pull request) in the UI copy

**Checkpoint**: `pnpm validate` passes.

---

## Slice 2: User Story 2 - See the Day grouped by Meal time (Priority: P2)

**Goal**: group Entries under headings with computed subtotals.

**Covers**: US2.1–US2.5, FR-003

**Behind Toggle**: `feature-173`

### Tests (write first, see them fail)

- [ ] T009 [P] [US2] Vitest: grouping, order and subtotals, in `src/features/entries/meal-time.test.ts`
- [ ] T010 [P] [US2] Testing Library: headings, no headings when untagged, Toggle off, in `entry-list.test.tsx`
- [ ] T011 [US2] Playwright: two Meal times show two groups, in `e2e/meal-times.spec.ts`

### Implementation

- [ ] T012 [US2] Group and subtotal helpers in `meal-time.ts`
- [ ] T013 [US2] Grouped rendering in `entry-list.tsx`, working with `entry-rows.ts` (leaving rows) and bulk selection, gated by the Toggle

**Checkpoint**: `pnpm validate` passes.

---

## Slice 3: User Story 3 - Change an Entry's Meal time later (Priority: P3)

**Goal**: chips in the edit sheet to change or clear the tag.

**Covers**: US3.1–US3.3, FR-004

**Behind Toggle**: `feature-173`

### Tests (write first, see them fail)

- [ ] T014 [P] [US3] Testing Library: chips shown, change and clear, rollback, Toggle off, in `edit-entry-sheet.test.tsx`
- [ ] T015 [US3] Playwright: change a tag and see the Entry move group, in `e2e/meal-times.spec.ts`

### Implementation

- [ ] T016 [US3] Update-Meal-time mutation (optimistic, rolls back) in `queries.ts`
- [ ] T017 [US3] Chips in `edit-entry-sheet.tsx`, gated by the Toggle

**Checkpoint**: `pnpm validate` passes.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Tag an Entry with a Meal time when adding it | US1.1–US1.9 | T001–T008 | — | No |
| 2 | See the Day grouped by Meal time | US2.1–US2.5 | T009–T013 | 1 | No |
| 3 | Change an Entry's Meal time later | US3.1–US3.3 | T014–T017 | 1 | No |
