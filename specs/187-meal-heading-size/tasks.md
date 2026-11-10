---
description: "Tasks for Meal headings that stand out"
---

# Tasks: Meal headings that stand out

**Input**: `spec.md` and `plan.md` in this folder.

**Spec issue**: #187

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - Meal headings read as headings (Priority: P1) 🎯 MVP

**Goal**: restyle the group heading so it is larger and bolder than an Entry's name.

**Covers**: US1.1–US1.5, FR-001–FR-003

**Behind Toggle**: `feature-173` (existing; this Round adds none)

### Tests (write first, see them fail)

- [ ] T001 [P] [US1] Testing Library: heading type classes, muted calories, level-3 role, none when off or untagged, in `entry-list.test.tsx`
- [ ] T002 [US1] Playwright: a heading's computed font size exceeds an Entry name's, and nothing overflows at 360 px, in `e2e/meal-times.spec.ts`

### Implementation

- [ ] T003 [US1] Restyle the heading in `entry-list.tsx` (larger, semibold, more space above, calories muted and normal weight), gated as now

**Checkpoint**: `pnpm validate` passes.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Meal headings read as headings | US1.1–US1.5 | T001–T003 | — | No |
