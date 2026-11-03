# 008: Daily logging

- **Status**: Draft
- **Depends on**: 003
- **ADRs**: 0001

## Goal

Logging what you ate takes two taps: pick a Food, pick a Quantity. The **Today** screen is the app's home. It shows the Day's **Daily Total** and Entries, and every change appears instantly through optimistic updates. The User can move to any past Day to log or correct it.

## User stories

- As a User, I want my usual Foods one tap away, so logging a regular breakfast takes seconds.
- As a User, I want to say I had 1½ slices, so the Quantity is honest.
- As a User who forgot yesterday, I want to log to a past Day.
- As a User, I want mistakes to be easy to undo.

## Acceptance criteria

- **AC-1**: Given I open the app, then **Today** shows today's Day (the device's local date), its Daily Total in large type, and its Entries, newest first, each showing Food name, "Quantity × Portion" and Calories (for example "1½ × 1 slice · 165 kcal").
- **AC-2**: Given I tap **Add**, then a picker sheet opens with:
  - a search box using spec 003's matching,
  - a **Recent** row of up to 8 Foods I logged most recently, as large chips,
  - all my non-Archived Foods sorted by how often I logged them in the last 90 days, then alphabetically.
- **AC-3**: Given I tap a Food in the picker, then Quantity buttons **½ 1 1½ 2 3** appear inline for that Food, with a **−/+** stepper (steps of 0.5, from 0.5 to 20). Tapping a Quantity adds the Entry, closes the sheet, and shows "Added 1½ × Sourdough toast" with **Undo**.
- **AC-4**: Given I add, change or remove an Entry, then the Entry list and Daily Total update immediately, before the server responds. If the server rejects the change, it rolls back and I see "Couldn't save. Retry?"
- **AC-5**: Given I tap an Entry, then a sheet lets me change its Quantity (the same buttons and stepper) or **Remove** it. Removing shows **Undo** for 5 seconds.
- **AC-6**: Given I add a Food that is already logged on that Day, then a separate Entry is created (see Open questions).
- **AC-7**: Given I tap the date header, then I can pick any past Day, or step a Day back or forward with arrows. Future Days are not selectable. The URL reflects the Day (`/?day=2026-11-03`), so the back button works.
- **AC-8**: An Entry's Day is a calendar date with no time zone conversion. An Entry added at 11:50 pm stays on that date wherever the server is.
- **AC-9**: A User can never read or write another User's Entries, and cannot create an Entry for another User's Food (pgTAP).
- **AC-10**: Given a Food has Entries, then deleting it through the API fails (`on delete restrict`), which backs spec 003's archive rule.
- **AC-11**: Given I have no Foods yet, then the picker shows an empty state linking to **Add food**.

## Out of scope

- Meal grouping (breakfast, lunch and so on).
- Logging a Food that isn't in the Food List. Adding it first is the flow.
- Offline queueing. Writes made without signal fail and roll back (AC-4).

## Design

**Schema**

```
entries (
  id uuid primary key,              -- generated on the client so optimistic rows keep their id
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  food_id uuid not null references foods on delete restrict,
  day date not null,
  quantity numeric(4,1) not null check (quantity > 0 and quantity <= 20 and quantity * 2 = floor(quantity * 2)),
  created_at timestamptz not null default now()
)
index on (user_id, day)
```

- RLS: `user_id = auth.uid()`. The insert and update `with check` also requires `exists (select 1 from foods f where f.id = food_id and f.user_id = auth.uid())` (AC-9).
- Replace spec 003's placeholder `food_entry_counts()` with the real count.
- `food_usage(since date)` returns `food_id, entry_count, last_logged_at` for picker ordering (AC-2).

**Client**
- Query keys live in one factory: `entryKeys.day(day)`, `foodKeys.usage()`.
- The Day view reads `entries` for the Day and joins Calories from the cached Food List on the client. The Daily Total is `Σ quantity × food.calories`, computed by a pure function, `dailyTotal(entries, foodsById)`, which summaries reuse.
- Optimistic mutations (`addEntry`, `updateEntryQuantity`, `removeEntry`) follow the TanStack Query pattern: `onMutate` snapshots and patches `entryKeys.day`, `onError` restores, `onSettled` invalidates the day and summary keys. Undo is a removal or re-insert of the same id.
- Quantity display: `formatQuantity(1.5) → "1½"` (pure).
- The Today tab becomes the real home route, replacing spec 002's placeholder.

## Test plan

- Vitest:
  - `dailyTotal` (including Archived Foods and fractional Quantities).
  - `formatQuantity`, and the picker ordering function given usage data (AC-2).
  - The optimistic cache helpers: patch and rollback (AC-4).
  - Day param parsing and the future-Day guard (AC-7).
- pgTAP:
  - RLS isolation.
  - The cross-User Food check (AC-9).
  - Quantity check constraint.
  - `on delete restrict` (AC-10).
  - `food_usage` ordering.
- Testing Library: the picker's Quantity buttons and stepper bounds, and Undo toasts (AC-3, AC-5).
- Playwright:
  - Two-tap logging updates the total (AC-1, AC-3).
  - Change Quantity, remove and undo (AC-5).
  - Log to yesterday through the date header and back button (AC-7).
  - A forced server failure, via a route intercept, rolls back (AC-4).

## Issue breakdown

| # | Slice | Covers |
|---|---|---|
| 1 | `entries` table with RLS, constraints and pgTAP. Real `food_entry_counts` | AC-8, AC-9, AC-10 |
| 2 | Today screen: Day header, Daily Total, Entry list (read-only, seeded data) | AC-1 |
| 3 | Picker sheet with search, Quantity buttons and optimistic add with Undo | AC-2 (without ordering), AC-3, AC-4, AC-11 |
| 4 | Edit Quantity and remove with Undo | AC-5, AC-6 |
| 5 | Recent row and frequency ordering (`food_usage`) | AC-2 |
| 6 | Past-Day navigation with the URL-synced Day | AC-7 |

## Open questions

- **When the same Food is added twice on one Day, should the Entries merge (Quantity adds up) or stay separate?** Default: separate, which matches "I had toast twice" and makes Undo exact. Revisit if the list gets cluttered.
- **Should tapping a Recent chip log Quantity 1 immediately, with no Quantity step?** Default: no. Keep it consistent with AC-3, so it's still two taps.
