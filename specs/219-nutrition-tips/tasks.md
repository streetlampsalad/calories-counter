---
description: "Tasks for Nutrition tips for last week"
---

# Tasks: Nutrition tips for last week

**Input**: `spec.md`, `plan.md`, `data-model.md` and `contracts.md` in this folder.

**Spec issue**: #219

**Tests are mandatory.** Every acceptance scenario gets a test task, written first and seen failing before its implementation task (constitution II).

## Slice 1: User Story 1 - Get Nutrition tips for last week (Priority: P1) 🎯 MVP

**Goal**: the Toggle, the route, the Gemini and fake tips writers, the card on Summary with all its states, the daily allowance and the About sentence.

**Covers**: US1.1–US1.10, FR-001–FR-006, FR-008

**Behind Toggle**: `feature-218`

### Tests (write first, see them fail)

- [ ] T001 [P] [US1] Vitest: last week's range for weeks starting on Sunday and Monday, the 3-Logged-Day check, and the per-Food summary (sums Quantity, the 80 Foods with the most Calories over the week, no ids), in `src/features/nutrition-tips/week.test.ts`
- [ ] T002 [P] [US1] Vitest: the route handler's 401, 404, 400 `bad_request`/`bad_week` (not a date, wrong week start day, ending after today, more than 14 Days ago), 422 before the allowance, 429, 503, 500, tidy-up (at most three, trimmed, cut to 40 and 200, empty dropped, none left → `tips_failed`) and 200, with a fake writer and injected deps, plus `getTipsWriter`'s choice, in `src/features/nutrition-tips/tips-handler.test.ts`
- [ ] T003 [P] [US1] Vitest: `GeminiTipsWriter` sends the system prompt with the add-only rules and Australian English, only names, Portions, Calories and Quantities, and parses the schema, with a stand-in transport, in `src/features/nutrition-tips/gemini-tips-writer.test.ts`
- [ ] T004 [P] [US1] Testing Library: the card's states (not enough Days, Get tips, working, tips with the disclaimer, limit, unavailable, failed with Try again), the 44 px button, and no card while the Toggle is off, loading or failed, in `src/features/nutrition-tips/tips-card.test.tsx`, and the gate on Summary in a new `src/features/summary/summary-screen.test.tsx`
- [ ] T005 [P] [US1] Testing Library: About's Nutrition tips sentence only when its `tipsOn` prop is true, in `src/features/settings/about-section.test.tsx`
- [ ] T006 [US1] Playwright: with the Toggle on and 3 Logged Days last week, Get tips shows the fake tips; with it off there is no card, in `e2e/nutrition-tips.spec.ts`

### Implementation

- [ ] T007 [US1] Migration `pnpm db:new toggle_nutrition_tips`, then `pnpm db:reset && pnpm db:types`
- [ ] T008 [US1] `week.ts`, `tips-handler.ts` (with `FakeTipsWriter` and `getTipsWriter`), `gemini-tips-writer.ts` on `geminiTransport` with `GEMINI_LIGHT_MODEL`
- [ ] T009 [US1] `src/app/api/nutrition-tips/route.ts`: user from `getClaims`, `isToggleOn("feature-218")`, Entries with the User's client, `increment_ai_usage("tips", 3)`
- [ ] T010 [US1] `queries.ts` (`nutritionTipKeys`, the Get tips mutation) and `tips-card.tsx`; render it at the bottom of `summary-screen.tsx` behind `useToggle("feature-218")`
- [ ] T011 [US1] About sentence: `About()` in `src/app/(app)/settings/page.tsx` passes `isToggleOn("feature-218")` to `AboutSection` (a Server Component, so not `useToggle`); `NUTRITION_TIPS: "fake"` in `playwright.config.ts`
- [ ] T012 [US1] Use the `CONTEXT.md` term **Nutrition tip** (added in the Spec pull request) in UI copy and code

**Checkpoint**: `pnpm validate` passes.

---

## Slice 2: User Story 2 - Keep last week's tips (Priority: P2)

**Goal**: one kept set per User per week, shown on reopening, replaced by Ask again.

**Covers**: US2.1–US2.6, FR-007

**Behind Toggle**: `feature-218`

### Tests (write first, see them fail)

- [ ] T013 [P] [US2] pgTAP: RLS and policies, one User cannot read, add, change or remove another's rows, the `tips` checks and the primary key, in `supabase/tests/database/nutrition_tips.test.sql`
- [ ] T014 [P] [US2] Vitest: the handler saves the set after a successful write, still answers 200 when the save fails, and saves nothing on any refusal, in `tips-handler.test.ts`
- [ ] T015 [P] [US2] Testing Library: kept tips shown with Ask again, a kept row that does not parse shown as no tips, Ask again replaces them, a failed Ask again keeps them with the error, a new week shows Get tips, and no read while the Toggle is off, in `tips-card.test.tsx`
- [ ] T016 [US2] Playwright: get tips, reload Summary, see the same tips with Ask again, in `e2e/nutrition-tips.spec.ts`

### Implementation

- [ ] T017 [US2] Migration `pnpm db:new nutrition_tips`, then `pnpm db:reset && pnpm db:types`
- [ ] T018 [US2] Upsert in the route after the write; `useKeptTips(weekStart)` in `queries.ts`, enabled only with the Toggle on; the mutation sets that query's data
- [ ] T019 [US2] Kept tips and Ask again in `tips-card.tsx`

**Checkpoint**: `pnpm validate` passes.

---

## Slices

| Slice | Title | Covers | Tasks | Blocked by | Human review |
|---|---|---|---|---|---|
| 1 | Get Nutrition tips for last week | US1.1–US1.10 | T001–T012 | — | Yes: Food names go to Gemini, and real tips cannot be proved in CI |
| 2 | Keep last week's tips | US2.1–US2.6 | T013–T019 | 1 | Yes: new table with RLS |
