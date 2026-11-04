# 015: Gestures, haptics and the picker keyboard

- **Status**: In progress
- **Depends on**: 008, 013, 014
- **Tracking issue**: [#76](https://github.com/streetlampsalad/calories-counter/issues/76)
- **ADRs**: —

## Goal

Logging should feel quick and physical on an Android phone. Three changes make that happen:

- The picker opens without the keyboard covering it, so Recent chips and the Food list are one tap away.
- Swiping left or right on the Day view moves between Days, and a bottom sheet can be dragged down to close it.
- The phone gives a short vibration when something important happens, such as an Entry being added. A Settings switch turns this off.

## User stories

- As a User, I want the picker to open with my Foods visible, not hidden behind the keyboard, so I can tap and log.
- As a User, I want to flick between Days with my thumb instead of reaching for the arrows.
- As a User, I want to close a sheet the way I close one in any other Android app.
- As a User, I want a small buzz when an Entry is added, so I know it worked without looking.
- As a User who dislikes vibration, I want to turn it off.

## Acceptance criteria

- **AC-1**: Given I tap **Add** on a Day, then the picker opens with nothing typeable focused and the keyboard stays hidden until I tap the search box. Screen readers still land inside the sheet, on its title. *(Adds to spec 008 AC-2. The **Add food** form keeps its name field focused.)*
- **AC-2**: Given I'm viewing a Day:
  - when I swipe left, the next Day shows, and when I swipe right, the previous Day shows,
  - the Day content follows my finger and slides in,
  - a swipe counts when it travels more than 25% of the screen width or is a quick flick,
  - a shorter one snaps back.

  Swipes follow the same limits as the arrows (spec 013 AC-1): at the last Day you can plan, a left swipe snaps back.
- **AC-3**: Swipes leave vertical scrolling of the Entry list alone. A gesture that starts mostly vertical never changes the Day, and one that starts within 24 px of either screen edge is ignored, so Android's back gesture still works.
- **AC-4**: Each Day changed by swiping is its own history entry, as with the arrows, so Android back walks back one Day at a time (spec 008 AC-7).
- **AC-5**: Swiping between Days is off while a sheet is open or selection mode is on (spec 014).
- **AC-6**: Given my device asks for reduced motion, then a swipe still changes the Day, but without the slide animation.
- **AC-7**: Given any bottom sheet is open, when I drag it down past a threshold or flick it down, then it closes, exactly as a tap on the backdrop would. A shorter drag snaps back. Dragging inside a sheet's scrolled list scrolls the list until it reaches the top, and only then drags the sheet.
- **AC-8**: With vibration on, the phone vibrates:
  - briefly when an Entry is added from the picker,
  - briefly when selection mode starts (spec 014 AC-1),
  - with a firmer pulse when a bulk delete of Entries or Foods is confirmed,
  - with a distinct double pulse when a save fails and rolls back.

  Nothing else vibrates: not swipes, Quantity stepper taps or navigation.
- **AC-9**: Settings has a **Vibration** switch, on by default and remembered on this device only. Off, nothing in AC-8 vibrates. On a device that can't vibrate, the switch is hidden.

## Out of scope

- Swiping between Periods on the Summary, pull to refresh, and swipe-to-delete on Entries (it would clash with Day swipes and long-press selection).
- Haptics on iOS. Safari has no Vibration API, and every current User is on Android (ADR 0002).
- Syncing the Vibration setting across devices.
- Replacing history entries instead of pushing them. The owner may revisit this after using swipes.

## Design

**Picker focus**: pass `initialFocus` to the picker's `SheetContent` (Base UI `Dialog.Popup`) to focus the sheet title or popup, not the search input. Base UI otherwise focuses the first tabbable element, which is what opens the keyboard today. Check `@base-ui/react`'s dialog docs for the prop's current shape.

**Day swipe**:
- `swipeOutcome({ dx, dy, velocityX, width, startX })` is pure and returns `"next" | "previous" | "none"`. It covers the 25% distance, flick velocity, edge exclusion and the vertical-intent lock, and Vitest tests it exhaustively.
- `useDaySwipe` attaches pointer listeners to the Day content with `touch-action: pan-y`, translates the content while dragging, and calls `goToDay` (which pushes history) on a counted swipe.
- The Day limits come from `parseDay` and `lastPlannableDay` (spec 013).
- Respect `prefers-reduced-motion` (AC-6).
- Disabled when `picking`, `editing` or selection is active (AC-5).

**Drag to dismiss**: `@base-ui/react` ships a `Drawer` with swipe-to-dismiss. Rebuild `SheetContent side="bottom"` in `src/components/ui/sheet.tsx` on it, or wrap the bottom variant, so every bottom sheet gets the gesture with no change at the call sites. Read its docs in `node_modules/@base-ui/react` first. Keep the existing `Sheet*` API, and keep `onOpenChange` as the single close path, so closing behaves the same however it's triggered (AC-7).

**Haptics** (`src/lib/haptics.ts`):
- `haptic(kind: "tap" | "confirm" | "error")` maps to `navigator.vibrate` patterns (for example 10 ms, 20 ms, and `[30, 60, 30]`). It does nothing when vibration is unsupported or switched off.
- The switch is a `localStorage` key, read through a small `useVibrationSetting()` hook, and the Settings screen gains a **Vibration** section (shadcn `switch`).
- The call sites are the `log` success path and the shared rollback `onError` handlers in entries and foods mutations, plus spec 014's selection start and bulk-delete confirm.
- Calls happen in response to a user gesture or soon after one, which Chrome requires for vibration.

## Test plan

- Vitest:
  - `swipeOutcome` across distance, velocity, edges, vertical intent and the limits (AC-2, AC-3).
  - `haptic` with `navigator.vibrate` stubbed: patterns per kind, the setting off, and unsupported (AC-8, AC-9).
- Testing Library:
  - The picker opens with `document.activeElement` not the search input (AC-1).
  - The Vibration switch persists and hides when unsupported (AC-9).
  - Swipe is ignored while a sheet is open (AC-5).
- Playwright (Pixel 7, touch):
  - Open the picker → the search box isn't focused → tap a Recent chip (AC-1).
  - Swipe left and right on Today → the Day and URL change → back walks back one Day at a time (AC-2, AC-4).
  - Swipe left on the last Day you can plan → no change (AC-2).
  - Drag the picker down → it closes (AC-7).
  - With `navigator.vibrate` spied on: adding an Entry vibrates once, and a forced failure gives the error pattern (AC-8).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | Picker opens without focusing the search box | AC-1 | [#77](https://github.com/streetlampsalad/calories-counter/issues/77) |
| 2 | `haptic` module, the **Vibration** setting, and vibration on Entry added and failed save | AC-8 (Entry added, failed save), AC-9 | [#78](https://github.com/streetlampsalad/calories-counter/issues/78) |
| 3 | Vibration on selection start and bulk delete. Blocked by spec 014 slices 1 and 3 | AC-8 (selection, bulk delete) | [#79](https://github.com/streetlampsalad/calories-counter/issues/79) |
| 4 | Swipe between Days. Blocked by spec 013 slice 2 | AC-2, AC-3, AC-4, AC-5, AC-6 | [#80](https://github.com/streetlampsalad/calories-counter/issues/80) |
| 5 | Drag a bottom sheet down to close it | AC-7 | [#81](https://github.com/streetlampsalad/calories-counter/issues/81) |

## Open questions

The owner accepted every default below on 2026-11-04; treat them as decisions.

- **Which gestures?** Day swipe and drag-to-dismiss sheets only.
- **Where is the Vibration setting stored?** On the device, not per User.
