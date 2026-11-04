# 003: Food List

- **Status**: Done
- **Depends on**: 002
- **Tracking issue**: [#11](https://github.com/streetlampsalad/calories-counter/issues/11)
- **ADRs**: 0001

## Goal

Each User has a **Food List**: their own Foods, each with a name, a **Portion** and its **Calories**. They can search it instantly, edit any Food (which changes every past Daily Total that uses it), and remove Foods they no longer eat. This spec builds the list itself. Adding Foods is specs 004–007, but slice 1 includes a minimal add form so the list can be exercised.

## User stories

- As a User, I want to find a Food in my list by typing a few letters, so a long list stays quick to use.
- As a User, I want to fix a Food's Calories and have my history correct itself, so a mistake doesn't follow me.
- As a User, I want to remove a Food I no longer eat without losing past Days, so my list stays short and my history stays true.

## Acceptance criteria

- **AC-1**: Given I have Foods, when I open **Foods**, then I see them sorted alphabetically, each showing name, Portion and Calories (for example "Sourdough toast · 1 slice · 110 kcal").
- **AC-2**: Given I type in the search box, then the list filters on every keystroke without a network request. Matching ignores case and accents and matches the start of any word: "toa" finds "Sourdough toast", and "cafe" finds "Café latte".
- **AC-3**: Given I edit a Food's name, Portion or Calories and save, then the list updates immediately (optimistically). If the save fails, the change rolls back and I see an error with **Retry**.
- **AC-4**: Given a Food has Entries, when I open its edit sheet, then I see "Changing this updates N past Entries", and after saving, every Daily Total that includes it reflects the new Calories (ADR 0001). *(Wording superseded by spec 013 AC-7: "N Entries", including Planned Entries.)*
- **AC-5**: Given a Food has no Entries, when I delete it and confirm, then it is permanently removed.
- **AC-6**: Given a Food has Entries, when I remove it, then it is Archived rather than deleted. It disappears from the Food List and from the logging picker, and past Entries and totals are unchanged.
- **AC-7**: Given I open **Archived Foods** from the Foods screen, then I can see Archived Foods and restore any of them to the Food List.
- **AC-8**: A Food's name (1–80 characters) and Portion (1–40 characters) are trimmed and required. Calories is a whole number from 0 to 9,999. Invalid input shows an inline message, and nothing is saved.
- **AC-9**: Two non-Archived Foods of one User cannot share the same name and Portion (ignoring case and surrounding spaces). Trying shows "You already have <name> (<portion>)".
- **AC-10**: A User can never see or change another User's Foods (pgTAP).
- **AC-11**: Given my Food List is empty, then I see an empty state explaining Foods, with an **Add food** action.

## Out of scope

- The add-Food flows themselves, beyond the minimal form in slice 1 (specs 004–007).
- Categories, tags, favourites, and nutrients other than Calories.

## Design

**Schema**

```
foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  portion text not null check (char_length(portion) between 1 and 40),
  calories integer not null check (calories between 0 and 9999),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
unique index on (user_id, lower(btrim(name)), lower(btrim(portion))) where archived_at is null
```

- RLS: `user_id = auth.uid()` for select, insert, update and delete.
- Deleting a Food that has Entries is rejected by the foreign key from `entries` (`on delete restrict`, spec 008). The client archives instead (AC-6), and the database guarantees history is never lost.
- An `updated_at` trigger keeps the timestamp current.
- `food_entry_counts()` (security invoker) returns `food_id, entry_count` for AC-4. Until spec 008 creates `entries`, it returns zero for every Food.

**Client**
- `useFoods()` loads the whole non-Archived Food List once (hundreds of rows at most) and caches it. Search is a pure function, `matchesFoodQuery(food, query)`, run in memory (AC-2). The logging picker in spec 008 reuses the same function.
- Mutations (`updateFood`, `archiveFood`, `restoreFood`, `deleteFood`) update the `foods` cache optimistically and invalidate every summary query key on success, because totals are derived (ADR 0001).
- Screens: `/foods` (list, search, **Add food** button above the bottom nav), an edit bottom sheet, and `/foods/archived`.
- Normalising and validating input lives in one module shared by the client and the tests. It trims input, collapses inner spaces and applies the AC-8 limits.

## Test plan

- Vitest: `matchesFoodQuery` (case, accents, word-start), input validation (AC-8), and optimistic cache helpers (AC-3 rollback).
- pgTAP:
  - RLS isolation between `ada` and `bea` (AC-10).
  - The unique index (AC-9).
  - The calorie bounds check (AC-8).
- Testing Library: the edit sheet shows the past-Entries warning when the count is greater than zero (AC-4).
- Playwright:
  - Search filters the list (AC-2).
  - Edit and see the change (AC-3).
  - Delete an unused Food (AC-5).
  - Archive and restore (AC-6, AC-7).
  - Empty state (AC-11).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | `foods` table, RLS and pgTAP. Foods screen with list and empty state, plus the minimal add form (name, Portion, Calories) | AC-1, AC-8, AC-9, AC-10, AC-11 | [#12](https://github.com/streetlampsalad/calories-counter/issues/12) |
| 2 | In-memory search | AC-2 | [#13](https://github.com/streetlampsalad/calories-counter/issues/13) |
| 3 | Edit sheet with optimistic update, rollback and the past-Entries warning | AC-3, AC-4 | [#14](https://github.com/streetlampsalad/calories-counter/issues/14) |
| 4 | Delete or archive, and the Archived Foods screen with restore. Add the Foods tab to the bottom nav | AC-5, AC-6, AC-7 | [#15](https://github.com/streetlampsalad/calories-counter/issues/15) |

## Open questions

The owner accepted every default below on 2026-11-03; treat them as decisions.

- **Should restoring an Archived Food that clashes with a current Food (same name and Portion) be blocked?** Default: yes, with the AC-9 message.
