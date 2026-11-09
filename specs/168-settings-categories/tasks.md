---
description: "Tasks for Settings in categories"
---

# Tasks: Settings in categories

**Input**: `spec.md` and `plan.md` in this folder.

**Spec issue**: #168

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - Settings is a short list of categories, each on its own page (Priority: P1) 🎯 MVP

**Goal**: the Toggle, the category hub, three category pages and the redirect when the Toggle is off.

**Covers**: US1.1–US1.9, FR-001–FR-004

**Behind Toggle**: `feature-167`

### Tests (write first, see them fail)

- [x] T001 [P] [US1] Testing Library: rows shown when on, single list when off, loading or failed, hidden empty categories, redirect when off, in `src/features/settings/settings-categories.test.tsx`
- [x] T002 [US1] Playwright: open each category, change a setting, go back, direct link redirects when off, in `e2e/settings-categories.spec.ts`

### Implementation

- [x] T003 [US1] Migration `pnpm db:new toggle_settings_categories` inserting the Toggle, then `pnpm db:reset && pnpm db:types`
- [x] T004 [US1] `src/features/settings/categories.ts` and the hub/gate component
- [x] T005 [US1] Pages `settings/tracking`, `settings/preferences`, `settings/features` with back links; `settings/page.tsx` uses the gate
- [x] T006 [US1] Keep Settings highlighted in the bottom navigation on category pages

**Checkpoint**: `pnpm validate` passes.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Settings is a short list of categories, each on its own page | US1.1–US1.9 | T001–T006 | — | No |
