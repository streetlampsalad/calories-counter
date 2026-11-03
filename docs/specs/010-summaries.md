# 010: Summaries

- **Status**: Ready
- **Depends on**: 008, 009
- **Tracking issue**: [#50](https://github.com/streetlampsalad/calories-counter/issues/50)
- **ADRs**: 0001

## Goal

The **Summary** tab answers "how am I going?" within a second of opening it. Choose a **Period**, see one big number and a chart of each Day, and tap a Day to jump to it. The detailed analysis lives in Insights (011).

## User stories

- As a User, I want this week's total and daily average at a glance.
- As a User, I want to compare last week or last month with my Goal.
- As a User, I want to see which Days were high, and jump to one to see why.

## Acceptance criteria

- **AC-1**: The Summary screen shows Period chips **This week**, **Last week**, **This month**, **Last month** and **Last 30 days**, with **This week** selected by default. The selection is kept in the URL (`/summary?period=last-week`).
- **AC-2**: Period ranges are calculated in the User's local calendar:
  - Weeks start on the User's **Week starts on** setting.
  - "This week" and "This month" run from the start of the week or month up to and including today.
  - "Last 30 days" is today and the 29 Days before it.
  - No Period includes future Days.
- **AC-3**: For the chosen Period, the headline shows:
  - the total Calories,
  - the average per **Logged Day**,
  - "N of M days logged".
- **AC-4**: Given a Goal is set, then the headline also shows the average versus Goal (for example "180 kcal under goal on average") and "Over goal on X of N logged days". Without a Goal, these are hidden.
- **AC-5**: A bar chart shows one bar per Day in the Period, with a horizontal Goal line when a Goal is set. Days with no Entries show as an empty slot, not a zero bar. Bars above the Goal use a distinct colour.
- **AC-6**: Given I tap a bar, then I go to that Day on the Today screen (`/?day=…`).
- **AC-7**: All numbers use the Foods' current Calories (ADR 0001). After I edit a Food, the Summary reflects it the next time it's shown, with no stale cache.
- **AC-8**: The Summary for a 31-Day Period loads in under 1 s on a mid-range Android phone over 4G, with one database round trip for the totals.
- **AC-9**: Given a Period has no Logged Days, then I see an empty state with a link to Today.
- **AC-10**: The chart is readable in light and dark mode, and the headline numbers are also available as text, so screen readers don't depend on the chart.

## Out of scope

- Custom date ranges.
- Trends, top Foods and patterns (spec 011).
- Exporting data.

## Design

- **Period maths** is pure: `periodRange(period, today, weekStartsOn) → { from, to, days }`, in `src/features/summary/period.ts`.
- **Database**: `daily_totals(from date, to date)` (security invoker, RLS applies) returns `day, calories, entry_count` for the caller's Logged Days in range:

  ```sql
  select e.day, sum(e.quantity * f.calories)::int, count(*)
  from entries e join foods f on f.id = e.food_id
  where e.day between $1 and $2
  group by e.day
  ```

  Because it joins current Food Calories, ADR 0001 holds automatically.
- **Headline maths** is pure: `summarise(dailyTotals, range, goal)` returns `{ total, averagePerLoggedDay, loggedDays, daysInRange, overGoalDays, averageVsGoal }`. It shares its rounding with Today.
- **Cache**: `summaryKeys.period(from, to)`. Food and Entry mutations invalidate `summaryKeys.all` (specs 003 and 008), which satisfies AC-7.
- **Chart**: the shadcn/ui chart component (Recharts). Load the `dataviz` skill before building it, for colours, the Goal reference line, and empty-slot treatment.

## Test plan

- Vitest is the core layer:
  - `periodRange` across week starts, month boundaries, leap years, the first day of a month, and today being the first day of the week (AC-2).
  - `summarise`, including Days with no Entries excluded from averages, with and without a Goal (AC-3, AC-4).
- pgTAP: `daily_totals` sums with fractional Quantities, uses the edited Calories after a Food update (AC-7), and is isolated per User.
- Testing Library: headline states, with Goal, without Goal, and empty (AC-3, AC-4, AC-9).
- Playwright:
  - Switch Periods and see the URL update (AC-1).
  - Tap a bar → Today for that Day (AC-6).
  - Edit a Food → the Summary total changes (AC-7).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | `periodRange` and `summarise` pure functions with exhaustive tests | AC-2, AC-3, AC-4 (logic) | [#51](https://github.com/streetlampsalad/calories-counter/issues/51) |
| 2 | `daily_totals` database function with pgTAP | AC-7, AC-8 | [#52](https://github.com/streetlampsalad/calories-counter/issues/52) |
| 3 | Summary screen with Period chips and headline, and the Summary tab in the nav | AC-1, AC-3, AC-4, AC-9, AC-10 | [#53](https://github.com/streetlampsalad/calories-counter/issues/53) |
| 4 | Daily bar chart with the Goal line and tap-through to the Day | AC-5, AC-6 | [#54](https://github.com/streetlampsalad/calories-counter/issues/54) |

## Open questions

The owner accepted every default below on 2026-11-03; treat them as decisions.

- **Should today count in "This week" averages while the day is still in progress?** Default: yes, if it has Entries. The headline marks it "includes today so far".
