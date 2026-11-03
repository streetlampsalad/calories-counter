# 009: Settings and Goal

- **Status**: Done
- **Depends on**: 002
- **Tracking issue**: [#45](https://github.com/streetlampsalad/calories-counter/issues/45)

## Goal

A User can set an optional daily calorie **Goal**, which Today (008) and summaries (010) compare against. They can also choose which day their week starts on and see the information an app using third-party data owes its users.

## User stories

- As a User, I want to set a daily Goal, so I can see at a glance whether I'm over or under.
- As a User, I want to clear my Goal, so I can just track without a target.

## Acceptance criteria

- **AC-1**: Given I open **Settings**, then I see my Google account email, **Daily goal** (shown as "Not set" by default), **Week starts on** (Monday by default), **About**, and **Sign out** (from spec 002).
- **AC-2**: Given I set a Goal from 500 to 10,000 kcal and save, then it applies everywhere immediately (optimistic), including the Today screen's Daily Total, which shows "1,840 / 2,200 kcal" with a progress bar that turns to the over-Goal colour above 100%.
- **AC-3**: Given I clear my Goal, then Today and the summaries show totals only, with no progress or comparisons.
- **AC-4**: Given I change **Week starts on** to Sunday, then "This week" and "Last week" in summaries (010) use Sunday-based weeks.
- **AC-5**: **About** shows the app version (commit SHA), data attribution for AFCD and Open Food Facts (spec 007 AC-10), and a note that photos and best guesses are processed by Google's Gemini API free tier, which may use them to improve Google's products (spec 006).
- **AC-6**: A User's settings are private to them (pgTAP). A User with no settings row gets the defaults without an error.

## Out of scope

- Calculating a Goal from body measurements.
- Goals that change over time. A single current Goal applies to every Day, including past ones, in the same spirit as ADR 0001.
- A kJ display preference, which stays a future option.

## Design

- `user_settings (user_id uuid primary key default auth.uid() references auth.users on delete cascade, daily_goal_calories integer check (daily_goal_calories between 500 and 10000), week_starts_on smallint not null default 1 check (week_starts_on in (0, 1)), updated_at timestamptz)`, with RLS on `user_id`.
- Reads use `useSettings()`, which returns the defaults when no row exists (AC-6). Writes are an upsert.
- The Settings tab is added to the bottom nav, upgrading spec 002's minimal Settings screen.

## Test plan

- pgTAP: RLS isolation, bounds, defaults.
- Vitest: Goal progress maths and the over-Goal state (AC-2).
- Testing Library: the Goal form's validation and clearing (AC-2, AC-3).
- Playwright: set a Goal → Today shows progress → clear it → progress disappears (AC-2, AC-3). About shows the attribution text (AC-5).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | `user_settings` table and `useSettings` with defaults | AC-6 | [#46](https://github.com/streetlampsalad/calories-counter/issues/46) |
| 2 | Settings screen: Goal set and clear, and Goal progress on Today | AC-1, AC-2, AC-3 | [#47](https://github.com/streetlampsalad/calories-counter/issues/47) |
| 3 | Week start setting | AC-4 | [#48](https://github.com/streetlampsalad/calories-counter/issues/48) |
| 4 | About section | AC-5 | [#49](https://github.com/streetlampsalad/calories-counter/issues/49) |

## Open questions

None.
