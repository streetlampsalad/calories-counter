# 019: Day view stability and motion

- **Status**: In progress
- **Depends on**: 008, 013, 015
- **Tracking issue**: [#95](https://github.com/streetlampsalad/calories-counter/issues/95)
- **ADRs**: —

## Goal

The Day view should feel steady and alive. Moving between Days never shifts the arrows, the date or the Daily Total, because the **Today** button no longer sits in the header's layout. When an Entry is added, changed or removed, the Daily Total counts up or down to its new value instead of jumping, and the Entry list animates the change.

## User stories

- As a User stepping back through past Days, I want the arrows to stay under my thumb, so I can keep tapping without aiming again.
- As a User, I want to see my total climb when I log something, so the change registers.
- As a User, I want added and removed Entries to animate, so I can tell what changed.

## Acceptance criteria

- **AC-1**: Moving between today and any other Day (arrows, swipe, date picker or **Today**) never moves the Previous and Next arrows, the date label, the Daily Total or the top of the Entry list. Their positions on screen are identical on today and on any other Day. (The optional Burned row of spec 017 is the one exception: it is absent on Days after today, so the Entry list starts higher there for a User who tracks Calories Burned.)
- **AC-2**: Given I'm viewing a Day other than today, then a **Today** pill floats at the bottom-left, level with **Add**:
  - It's at least 44 px tall and sits above the bottom navigation, clear of the gesture area.
  - Tapping it goes to today as a new history entry, so back returns to the Day I came from (spec 013 AC-8).
  - It's hidden on today and in selection mode (spec 014), like **Add**.
  - It fades in and out, without taking space from or covering the Day's content.

  *(Supersedes the placement in spec 013 AC-8, "in the Day header".)*
- **AC-3**: Given the Daily Total changes while I stay on the same Day (add, Quantity change, remove, Undo, a rollback after a failed save, or a bulk delete), then the number counts from its old value to its new one over about 400 ms, easing out, and stops exactly on the new value:
  - A change that arrives mid-count continues from the number currently shown.
  - The Goal figure and "kcal" don't move while the digits count.
- **AC-4**: Given I open the app or move to another Day, then the Daily Total shows that Day's value immediately, with no counting.
- **AC-5**: Screen readers announce only the final Daily Total, once per change, never the intermediate numbers.
- **AC-6**: The Goal progress bar eases to its new width over the same duration as the count. Its colour changes when the total crosses the Goal.
- **AC-7**: An added Entry fades and slides into the list, and a removed Entry fades and collapses out, while the rows around it move smoothly into place. Switching Days doesn't animate rows; the existing Day slide from spec 015 still applies.
- **AC-8**: Given my device asks for reduced motion, then the Today pill appears and disappears instantly, the Daily Total and progress bar change instantly, and rows appear and disappear without animation.

## Out of scope

- Animations elsewhere, such as tab changes, sheets, the Summary chart or Insights.
- Counting animation for the Summary headline or the Burned row (spec 017).
- Haptics, which are covered by spec 015.

## Design

**Today pill**
- Remove the button from `DayHeader`.
- Render it in `today-screen.tsx` in the same fixed bottom bar as **Add**: the container becomes `justify-between`, with **Today** on the left (secondary, `h-11 rounded-full`) and **Add** on the right.
- Fade with `motion-safe:` utilities from `tw-animate-css`, matching the existing slide classes. It stays mounted for the fade-out (for example `data-state` with `pointer-events-none` when hidden).
- The Entry list's bottom padding already clears **Add**, so it also clears the pill.

**Counting number**
- `tweenValue(from, to, elapsedMs, durationMs)` is pure: ease-out cubic, rounded to whole kcal, and exactly `to` at or after the duration.
- `useAnimatedNumber(value, { resetKey: day })` drives it with `requestAnimationFrame`. It retargets from the number currently shown, snaps when `resetKey` changes (AC-4), and snaps when `matchMedia("(prefers-reduced-motion: reduce)")` matches (AC-8).
- In `DailyTotal`, the visible number is `aria-hidden`, and a visually hidden live region holds the final value (AC-5). The existing `aria-live` moves to that region.
- The digits already use `tabular-nums`. Give the number a minimum width based on its final value's digit count so the Goal figure doesn't jump between three and four digits mid-count.

**Progress bar**: set the existing `transition-[width]` to `duration-400 ease-out`, with `motion-reduce:transition-none`.

**Entry rows**
- Before building, check whether React 19.3 and Next 16.4 support `<ViewTransition>` for list enter, exit and reorder (`node_modules/next/dist/docs/`, the `modern-web-guidance` skill).
- If they do, use it. Otherwise, use CSS `@starting-style` for the enter animation, and a short exit state that keeps a removed row mounted for its collapse before it leaves the cache-driven list.
- The animation must not change Undo, selection or optimistic rollback behaviour.

## Test plan

- Vitest: `tweenValue` at 0, mid-way and the end, past the duration, counting down, and from equals to (AC-3).
- Testing Library:
  - `useAnimatedNumber` with fake timers and a stubbed `requestAnimationFrame`: counts and ends exact, retargets mid-count, snaps on a `resetKey` change, and snaps under reduced motion (AC-3, AC-4, AC-8).
  - `DailyTotal` exposes one live region with the final value (AC-5).
  - The Today pill's visibility on today, other Days and in selection mode (AC-2).
- Playwright (Pixel 7):
  - Record the bounding boxes of the arrows, the date label and the Daily Total on today, step to yesterday and to a planned Day, and assert identical `y` positions (AC-1).
  - Tap **Today** → today, then back returns to the previous Day (AC-2).
  - Add an Entry and sample the total mid-count to see an intermediate value, then the final value (AC-3).
  - With `reducedMotion: "reduce"`, the total changes without intermediate values (AC-8).
- Update `day-header.test.tsx` and the spec 013 e2e test, which look for **Today** in the header.

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | Move **Today** to a floating pill beside **Add**, so the Day header never shifts | AC-1, AC-2, AC-8 (pill) | [#96](https://github.com/streetlampsalad/calories-counter/issues/96) |
| 2 | Daily Total counts to its new value, and the progress bar eases with it | AC-3, AC-4, AC-5, AC-6, AC-8 (total, bar) | [#97](https://github.com/streetlampsalad/calories-counter/issues/97) |
| 3 | Entry rows animate in and out | AC-7, AC-8 (rows) | [#98](https://github.com/streetlampsalad/calories-counter/issues/98) |

## Open questions

The owner accepted every default below on 2026-11-04; treat them as decisions.

- **Where does Today go?** A floating pill at the bottom-left, opposite **Add**.
- **Which animations?** The Daily Total count, the progress bar, Entry rows in and out, and the Today pill fade. Nothing else.
- **Does the total count when switching Days?** No. It jumps.
