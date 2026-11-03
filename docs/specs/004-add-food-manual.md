# 004: Add Food: manual entry

- **Status**: Ready
- **Depends on**: 003
- **Tracking issue**: [#16](https://github.com/streetlampsalad/calories-counter/issues/16)

## Goal

Adding a Food by hand takes seconds on a phone: type a name, tap a Portion chip, and enter Calories, or kilojoules straight off an Australian label. This form also becomes the shared Food form that search (007) prefills.

## User stories

- As a User, I want common Portions as tap targets, so I rarely type them.
- As a User reading an Australian label, I want to enter kJ and have it converted, so I don't do maths in the supermarket.
- As a User adding several Foods, I want **Save and add another**, so I stay in the flow.

## Acceptance criteria

- **AC-1**: Given I tap **Add food → Enter manually**, then a form opens with the name field focused and the numeric keypad used for Calories (`inputmode="numeric"`).
- **AC-2**: The Portion field offers chips **100 g**, **100 ml**, **1 serve**, **1 slice**, **1 cup**, **1 piece**. Tapping one fills the field, which I can still edit freely.
- **AC-3**: Given I switch the energy unit to **kJ** and enter 1,000, then the form shows "= 239 kcal", and the saved Food has 239 Calories (kJ ÷ 4.184, rounded half up).
- **AC-4**: Given valid input, when I tap **Save**, then the Food appears in the Food List immediately (optimistic) and I return to the list. With **Save and add another**, the form clears and keeps the last-used Portion chip highlighted.
- **AC-5**: Given the name and Portion match an existing Food, then saving is blocked with "You already have <name> (<portion>)" and a link to edit that Food.
- **AC-6**: The validation rules in spec 003 AC-8 apply, with inline messages shown as I type.
- **AC-7**: The form component accepts initial values and a source label (for example "From Open Food Facts"), so other specs can prefill it. Covered by a component test.

## Out of scope

- Barcode scanning.
- Recipes built from other Foods.

## Design

- `FoodForm` (client component) is controlled by a schema shared with spec 003's validation module. Its props are `initialValues`, `sourceLabel` and `onSaved`.
- kJ to kcal conversion is a pure function, `kilojoulesToCalories(kj: number): number`, in a domain module. Imports (005) and search (007) reuse it.
- The **Add food** button on the Foods screen opens an action sheet. This spec adds its first option, **Enter manually**. Specs 005–007 add the others.
- On a duplicate-key error from the database (AC-5), the form maps the unique-violation code to the message rather than showing a generic error.

## Test plan

- Vitest: `kilojoulesToCalories`, covering 0, 1000 → 239, 4.184 → 1 and the rounding edge cases (AC-3).
- Testing Library:
  - Chips fill the Portion field (AC-2).
  - The kJ preview (AC-3).
  - Prefill and the source label (AC-7).
  - Inline validation (AC-6).
- Playwright:
  - Add a Food and see it in the list (AC-4).
  - Save and add another (AC-4).
  - Duplicate blocked (AC-5).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | `FoodForm` with validation and Portion chips, replacing spec 003's minimal form. **Add food** action sheet with **Enter manually** | AC-1, AC-2, AC-4, AC-6, AC-7 | [#17](https://github.com/streetlampsalad/calories-counter/issues/17) |
| 2 | kJ entry and conversion | AC-3 | [#18](https://github.com/streetlampsalad/calories-counter/issues/18) |
| 3 | Duplicate handling with a link to the existing Food | AC-5 | [#19](https://github.com/streetlampsalad/calories-counter/issues/19) |

## Open questions

The owner accepted every default below on 2026-11-03; treat them as decisions.

- **Should the kcal/kJ choice be remembered between visits?** Default: yes, per device in `localStorage`, starting on kcal.
