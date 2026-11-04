# 013: Planned Entries

- **Status**: Done
- **Depends on**: 008, 010, 011
- **Tracking issue**: [#68](https://github.com/streetlampsalad/calories-counter/issues/68)
- **ADRs**: 0001, 0004

## Goal

A User who plans meals can log them ahead of time. Any Day up to 14 Days after today can be opened, and Entries added there are **Planned Entries**. They are ordinary Entries whose Day hasn't arrived yet, so when it does they count like any other, with no step to confirm (ADR 0004). Until then, no summary, insight or picker ordering counts them, because those only ever look at today and earlier.

## User stories

- As a User who plans the week's meals, I want to log them in advance, so that on the Day there's nothing left to do.
- As a User, I want my Summary and Insights to reflect what I've actually eaten, not what I've planned.
- As a User, I want to see what a planned Day adds up to against my Goal, so I can adjust the plan before I eat it.

## Acceptance criteria

- **AC-1**: Given I'm viewing any Day before the 14th Day after today, then **Next day** steps one Day forward. On the 14th Day after today it is disabled. The date picker offers Days up to and including the 14th Day after today. A `?day=` that is later than that, malformed or impossible shows today. *(Supersedes the "Future Days are not selectable" sentence of spec 008 AC-7. The rest of that criterion, including one history entry per Day change, still applies.)*
- **AC-2**: Given I'm viewing a Day after today, then:
  - the header reads "Tomorrow" for the next Day, or "Thu 6 Nov" for later Days,
  - the big number has a visible **Planned** label, and its heading reads "Planned total" for screen readers,
  - the Goal progress ("150 left" or "200 over") still shows when a Goal is set.

  Today and past Days look exactly as they do now.
- **AC-3**: Given I add a Food on a Day after today, then the toast reads "Planned 1½ × Sourdough toast for Thu 6 Nov" (or "for tomorrow"), with **Undo**. Changing the Quantity and removing work as in spec 008 AC-5.
- **AC-4**: Given a Day with Planned Entries arrives, then on that Day its Entries appear on Today as ordinary Entries and count in its Daily Total, with no action from me (ADR 0004).
- **AC-5**: Planned Entries are never counted by the Summary (every Period, the headline and the chart) or by Insights (Trend, Top foods, Day of week, Goal and Logging streak). For example, an Entry planned for tomorrow leaves "This week"'s total, "N of M days logged" and the logging streak unchanged.
- **AC-6**: The picker's **Recent** row and its frequency ordering count only Entries on Days up to and including today. A Food that has only been planned does not appear in **Recent**.
- **AC-7**: Given a Food has Entries, when I open its edit sheet, then I see "Changing this updates N Entries", where N includes Planned Entries, because editing a Food changes them too (ADR 0001). *(Supersedes the wording "N past Entries" in spec 003 AC-4.)*
- **AC-8**: Given I'm viewing any Day other than today, then a **Today** button shows in the Day header. Tapping it goes to today as a new history entry, so back returns to the Day I came from. On today it is hidden. *(Spec 019 AC-2 moves it out of the header into a floating pill beside **Add**.)*

## Out of scope

- Copying a Day's Entries to another Day, or repeating meal plans.
- Marking a Planned Entry as eaten. The Day arriving is what makes it count (ADR 0004).
- Any summary of the plan beyond the planned Day's own total.
- Planning further than 14 Days ahead.

## Design

**No schema change.** A Planned Entry is any Entry with `day` after the device's today. The database doesn't limit how far ahead an Entry can be. The 14-Day limit is a client rule, like the existing future-Day guard it replaces.

**Day maths** (`src/features/entries/days.ts`, pure):
- `PLAN_AHEAD_DAYS = 14` and `lastPlannableDay(today) = shiftDay(today, 14)`.
- `parseDay` returns today for anything after `lastPlannableDay(today)`, rather than anything after today.
- `isPlanned(day, today) = day > today`.
- `dayLabel` adds "Tomorrow".

**Day header**: the Next arrow is disabled at `lastPlannableDay`, the date input's `max` becomes `lastPlannableDay`, and there's a **Today** button (44 px target) shown when `day !== today`.

**Daily total**: `DailyTotal` takes `planned: boolean` for the label and heading. The total itself is unchanged: `dailyTotal(entries)`.

**Summary and Insights**: every range already ends at today (`periodRange`, the Insights ranges, `historyRange`). Nothing changes except regression tests that seed a Planned Entry and prove it is ignored (AC-5).

**Picker ordering**: add a migration with a two-argument overload, `food_usage(since date, until date)`, that adds `and e.day <= until`. `useFoodUsage` passes `today`. The one-argument version stays, because the deployed app calls it until this slice ships (ADR 0003). A later migration can drop it.

**Edit Food copy**: `entriesWarning` drops "past". `food_entry_counts()` is unchanged, since it already counts every Entry.

## Test plan

- Vitest:
  - `parseDay` at today, at `lastPlannableDay`, and one Day past it (AC-1).
  - `isPlanned` and `dayLabel` "Tomorrow" (AC-2).
  - The `entriesWarning` wording (AC-7).
- Testing Library:
  - `DayHeader` Next disabled at the limit and the **Today** button's visibility (AC-1, AC-8).
  - `DailyTotal` with `planned` (AC-2).
- pgTAP: `food_usage(since, until)` ignores Entries after `until`, and is isolated per User (AC-6).
- Playwright:
  - Step to tomorrow → add a Food → see the "Planned … for tomorrow" toast and the **Planned** total → **Today** → back returns to tomorrow (AC-1, AC-2, AC-3, AC-8).
  - With a Planned Entry seeded for tomorrow: the Summary's "This week" total and Insights' streak match the totals without it (AC-5), and the picker's **Recent** row doesn't show that Food (AC-6).
  - With an Entry seeded for a Day that has now arrived: it shows on Today and counts (AC-4). Seed it relative to the test's today rather than mocking the clock.

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | `food_usage(since, until)` overload and picker switch-over, the "N Entries" wording, and Summary and Insights regression tests with a seeded Planned Entry. Ships before any Planned Entry can be created | AC-5, AC-6, AC-7 | [#69](https://github.com/streetlampsalad/calories-counter/issues/69) |
| 2 | Step and pick Days up to 14 ahead, the **Planned** total and the "Planned … for …" toast | AC-1, AC-2, AC-3, AC-4 | [#70](https://github.com/streetlampsalad/calories-counter/issues/70) |
| 3 | **Today** button in the Day header | AC-8 | [#71](https://github.com/streetlampsalad/calories-counter/issues/71) |

## Open questions

The owner accepted every default below on 2026-11-04; treat them as decisions.

- **How far ahead can a User plan?** 14 Days.
- **Should the back button replace or push history when moving between Days?** Push, one entry per Day change, as now. The owner may revisit this after using swipes (spec 015).
