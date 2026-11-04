# 017: Calories Burned and the Deficit

- **Status**: Done
- **Depends on**: 008, 009, 010
- **Tracking issue**: [#89](https://github.com/streetlampsalad/calories-counter/issues/89)
- **ADRs**: 0001

## Goal

A User who wants to can record each Day's **Calories Burned** from their watch, and see whether they ate less than they burned: a **Deficit**, or otherwise a **Surplus**. This is optional and switched off by default. A User who only tracks intake sees no change anywhere. Values are entered by hand for now. Spec 018 plans to fill them from Google Health.

## User stories

- As a User with a Fitbit, I want to type in what my watch says I burned, so I can see whether I'm in a Deficit.
- As a User, I want to see my average Deficit over a week or month, so I know whether I'm on track overall.
- As a User who just counts calories eaten, I don't want burned calories cluttering the app.

## Acceptance criteria

- **AC-1**: Given I open **Settings**, then I see a **Track calories burned** switch, off by default. It's saved to my settings, so it applies on every device, and it updates immediately (optimistic).
- **AC-2**: While the switch is off, Today, the Summary and Insights show nothing about Calories Burned, Deficit or Surplus, and look exactly as they do without this spec. Turning it off keeps my values, and turning it back on shows them again.
- **AC-3**: With the switch on, Today and past Days show a **Burned** row directly under the Daily Total:
  - "Burned · Add" when the Day has no Calories Burned,
  - "Burned 2,450 kcal · 610 kcal deficit" when the Day has Calories Burned and Entries,
  - "Burned 2,450 kcal · 200 kcal surplus" when the Day's Daily Total is higher,
  - "Burned 2,450 kcal · Log food to see your deficit" when the Day has Calories Burned but no Entries.

  On today the label reads "Burned so far". Days after today show no Burned row.
- **AC-4**: Given I tap the Burned row, then a sheet opens with a number field for whole kcal (500 to 10,000), **Save**, and, when a value exists, **Clear**:
  - Saving replaces any previous value for that Day.
  - Changes appear immediately and roll back on failure with "Couldn't save. Retry?" (spec 008 AC-4).
  - Values outside the range can't be saved, with the message "Enter between 500 and 10,000 kcal".
- **AC-5**: The Deficit is Calories Burned minus the Daily Total. It's computed from the Foods' current Calories (ADR 0001) and never stored, so editing a Food updates past Deficits.
- **AC-6**: With the switch on, given a Period with at least one Day that has both Entries and Calories Burned, then the Summary headline adds:
  - "Average deficit 420 kcal", or "Average surplus 150 kcal",
  - "In deficit on X of N days".

  Both count only Days up to today that are Logged Days and have Calories Burned. Days missing either are left out, never counted as zero. Given no such Days, the headline adds "Add calories burned on Today to see your deficit". The chart is unchanged.
- **AC-7**: The Summary still makes one database round trip for its totals (spec 010 AC-8).
- **AC-8**: A User can never read or change another User's Calories Burned. There is at most one value per User per Day, and values outside 500 to 10,000 are rejected (pgTAP).

## Out of scope

- Syncing from Google Health or any other source (spec 018).
- A Deficit target, a Deficit chart or Insights about burned calories.
- Splitting Calories Burned into resting and exercise, or logging individual workouts.
- Changing the Goal on days with exercise. The Goal stays the intake target.

## Design

**Schema** (adds only)

```
alter table user_settings add column track_calories_burned boolean not null default false;

calories_burned (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  calories integer not null check (calories between 500 and 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
)
```

- RLS on `user_id = auth.uid()` for select, insert, update and delete. Writes upsert on `(user_id, day)`.
- Summary: add `period_days(range_from date, range_to date)` (security invoker). It returns `day, calories, entry_count, calories_burned` for each Day in range that has Entries or Calories Burned, as a full outer join of the `daily_totals` aggregate with `calories_burned`. The Summary switches to it. `daily_totals` stays, because Insights (spec 011) still reads it.

**Pure logic** (`src/features/burned/domain.ts`)
- `deficit(dailyTotal, caloriesBurned)` returns a signed number: positive is a Deficit and negative is a Surplus.
- `formatDeficit(n)` returns "610 kcal deficit" or "200 kcal surplus".
- `summariseDeficit(days, today)` returns `{ averageDeficit, daysInDeficit, daysCounted }`, counting only Days up to today with both values.

**Client**
- `burnedKeys.day(day)` lives in the feature's key factory. Mutations invalidate `summaryKeys.all`.
- `BurnedRow` and `BurnedSheet` (a shadcn `input` with `inputMode="numeric"`) render only when `settings.trackCaloriesBurned` is on and the Day is not after today.
- Settings: `trackCaloriesBurned` is added to `toSettings` and `DEFAULT_SETTINGS`, with a **Track calories burned** section.

## Test plan

- pgTAP: `calories_burned` RLS isolation, the range check, the primary key, and `period_days` (Days with only Entries, only Calories Burned, or both).
- Vitest: `deficit`, `formatDeficit`, and `summariseDeficit` (excluded Days, future Days, a zero Deficit) (AC-5, AC-6).
- Testing Library:
  - The Burned row's four states, and its absence on future Days and with the switch off (AC-2, AC-3).
  - The sheet's validation, Save and Clear (AC-4).
- Playwright:
  - Turn on **Track calories burned** → enter 2,450 on today → see the Deficit → add an Entry → the Deficit shrinks → the Summary shows the average (AC-1, AC-3, AC-5, AC-6).
  - Turn the switch off → no Burned row or Deficit anywhere (AC-2).
  - A forced failure rolls back (AC-4).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | `calories_burned` table, the `track_calories_burned` setting and `period_days`, with pgTAP | AC-8 | [#90](https://github.com/streetlampsalad/calories-counter/issues/90) |
| 2 | **Track calories burned** switch, plus the Burned row and sheet on the Day view. Blocked by 1 | AC-1, AC-2 (Day view), AC-3, AC-4, AC-5 | [#91](https://github.com/streetlampsalad/calories-counter/issues/91) |
| 3 | Deficit in the Summary headline, moving the Summary to `period_days`. Blocked by 1 | AC-2 (Summary, Insights), AC-6, AC-7 | [#92](https://github.com/streetlampsalad/calories-counter/issues/92) |

## Open questions

The owner accepted every default below on 2026-11-04; treat them as decisions.

- **What does the Deficit compare against?** Total Calories Burned (resting plus activity), not workout calories alone, and not the Goal.
- **Is there a Deficit target?** No. Only whether each Day is in Deficit, and by how much.
- **Where is the switch stored?** Per User, like the Goal.
