# 011: Insights

- **Status**: Draft
- **Depends on**: 010

## Goal

From the Summary, a User can dig deeper: long-term trends, which Foods drive their Calories, weekly patterns, and how consistently they log. Each insight is one card with a plain-English headline above its chart, so it reads at a glance.

## User stories

- As a User, I want to see whether my intake is trending up or down over months.
- As a User, I want to know which Foods contribute most to my Calories, so I know what to change.
- As a User, I want to know whether weekends are my weak spot.

## Acceptance criteria

- **AC-1**: The Summary screen has **See insights**, which opens `/summary/insights` for the same Period. Insights also offers **3 months**, **6 months** and **12 months**.
- **AC-2**: **Trend** card: a line of the 7-Day rolling average over Logged Days (Days with no Entries don't count as zero) for the chosen range, with the Goal line if set. The headline says, for example, "Your 7-day average is down 120 kcal since August".
- **AC-3**: **Top foods** card: the 10 Foods contributing the most Calories in the Period, each with total Calories, its share of the Period total (%), and times logged. Archived Foods are included and marked. Tapping a Food opens it in the Food List, or in Archived Foods if Archived.
- **AC-4**: **Day of week** card: the average Calories per Logged Day for each weekday, starting on the User's week start, with the highest day called out ("Saturdays average 2,600 kcal").
- **AC-5**: **Goal** card (only when a Goal is set): Days over and under Goal in the Period, and the current run of consecutive Logged Days under Goal.
- **AC-6**: **Logging streak** card: the current run of consecutive Logged Days ending today (or yesterday if today has none yet), and the longest run ever.
- **AC-7**: Every card shows an empty state when it has too little data (for example the Trend card needs at least 7 Logged Days) instead of a misleading chart.
- **AC-8**: The 12-month view loads in under 2 s on a mid-range Android phone over 4G.
- **AC-9**: Every card's key number is available as text for screen readers (as in spec 010 AC-10).

## Out of scope

- Weight, exercise or data from other fitness apps. This is a future integration, and the card layout should leave room for it.
- Push notifications or nudges.

## Design

- **Database** (security invoker, so RLS applies):
  - Reuse `daily_totals(from, to)` from spec 010 for the Trend, Day of week, Goal and streak cards.
  - Add `food_totals(from, to)`, which returns `food_id, calories, entry_count` for Top foods.
  - For streaks: `logged_days(until date)`, which returns distinct Days, or calculate them on the client from `daily_totals` over the last 400 Days. Choose by measuring AC-8.
- **Pure functions** in `src/features/insights/`: `rollingAverage(dailyTotals, window, range)`, `dayOfWeekAverages(dailyTotals, weekStartsOn)`, `streaks(loggedDays, today)`, `goalSplit(dailyTotals, goal)`, and `trendHeadline(...)`. These are where the risk is, so they get exhaustive tests.
- **Charts**: the shadcn/ui chart component. Load the `dataviz` skill before building any card.
- Cards stack in a single column on a phone. On wider screens they wrap into two columns.

## Test plan

- Vitest:
  - `rollingAverage` with gaps (AC-2).
  - `dayOfWeekAverages` with each week start (AC-4).
  - `streaks` across today and yesterday edge cases and gaps (AC-6).
  - `goalSplit` (AC-5).
  - Headline wording (AC-2, AC-4).
  - Minimum-data thresholds (AC-7).
- pgTAP: `food_totals` correctness, Archived Foods included, isolated per User.
- Testing Library: each card's empty state (AC-7) and text alternative (AC-9).
- Playwright: open Insights from the Summary → switch to 3 months → tap a Top food → it opens in the Food List (AC-1, AC-3).

## Issue breakdown

| # | Slice | Covers |
|---|---|---|
| 1 | Insights route and range selector, with the entry point from the Summary | AC-1 |
| 2 | Trend card | AC-2, AC-7, AC-9 |
| 3 | `food_totals` and the Top foods card | AC-3, AC-7, AC-9 |
| 4 | Day of week card | AC-4, AC-7, AC-9 |
| 5 | Goal and logging streak cards | AC-5, AC-6, AC-7, AC-9 |
| 6 | Performance check on 12 months of seeded data | AC-8 |

## Open questions

- **Should Top foods rank by total Calories or by times logged?** Default: by total Calories, with a toggle for times logged.
