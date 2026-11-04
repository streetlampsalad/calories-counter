# 014: Selection and bulk delete

- **Status**: Done
- **Depends on**: 003, 008
- **Tracking issue**: [#72](https://github.com/streetlampsalad/calories-counter/issues/72)
- **ADRs**: 0001

## Goal

A User can clear out several Foods or Entries at once. Holding an item puts the list into selection mode with that item selected, further taps add or remove items, and **Delete** removes them all in one go with **Undo**. Foods follow the same archive-or-delete rule as removing one (ADR 0001). Bulk editing is not part of this spec.

## User stories

- As a User tidying my Food List after an Import, I want to remove several Foods in one go rather than one sheet at a time.
- As a User who logged the wrong meal, or whose plan changed, I want to clear several Entries from a Day quickly.
- As a User, I want a bulk delete to be as easy to undo as a single one.

## Acceptance criteria

- **AC-1**: Given I'm on the Foods screen or viewing a Day's Entry list, when I hold an item for about 500 ms, then selection mode starts with that item selected, and the edit sheet does not open. Moving my finger more than 10 px before then cancels the hold, so scrolling never selects.
- **AC-2**: Given selection mode is on, then:
  - tapping an item toggles it rather than opening its edit sheet,
  - each item shows whether it is selected, both visually and to screen readers,
  - a bar replaces the screen's header with "N selected", **Select all**, **Delete** and **✕**,
  - the floating **Add** buttons are hidden.
- **AC-3**: Selection mode ends, clearing the selection, when I tap **✕**, press Android back (which doesn't navigate), deselect the last item, or finish a Delete.
- **AC-4**: Given I'm selecting on the Foods screen, then the search box stays usable, **Select all** selects every Food currently shown, and Foods I've selected stay selected when the search changes. "N selected" counts all of them.
- **AC-5**: Given I've selected Entries, when I tap **Delete**, then they disappear at once (optimistically) with no confirmation, and a toast reads "Removed 4 entries" with **Undo** for 5 seconds. Undo puts the same Entries back (same ids). If the server rejects the delete, every one comes back and I see "Couldn't save. Retry?"
- **AC-6**: Given I've selected Foods, when I tap **Delete**, then a confirmation spells out what will happen:
  - "Remove 5 foods? 3 you've logged will be archived, 2 will be deleted."
  - or, when only one kind applies, "Archive 3 foods?" or "Delete 2 foods?"

  On confirming, the logged Foods are Archived and the rest are deleted for good, in one request. A toast reads "Removed 5 foods" with **Undo**. Undo restores the Archived ones and re-creates the deleted ones with their original ids and values. A failed remove or Undo rolls back and shows an error with **Retry**.
- **AC-7**: Removing Foods decides archive or delete on the server, at the moment of removal. A Food that gained an Entry after the confirmation opened is Archived, not deleted or failed. A User can never remove, archive or restore another User's Foods (pgTAP).

## Out of scope

- Bulk editing (changing the Quantity, Day or Food of many Entries, or the Calories of many Foods).
- Selection in the picker, Archived Foods or Import review.
- Moving or copying selected Entries to another Day.
- Vibration on long press and on Delete. Spec 015 adds it.

## Design

**Shared client pieces** (`src/components/selection/` or `src/lib/selection/`):
- `selectionReducer` is pure: `start(id)`, `toggle(id)`, `selectAll(ids)` and `clear()`, and deselecting the last id ends selection. Vitest covers it exhaustively.
- `useLongPress({ onLongPress, onPress, delay = 500, tolerance = 10 })` works with pointer events. It cancels on move, cancel or scroll, and suppresses the click that follows a long press. The press-versus-hold decision is a pure function of elapsed time and distance, so it can be tested without a DOM.
- `SelectionBar` holds the count, **Select all**, **Delete** and **✕**, and its touch targets are 44 px. Android back is handled by pushing a history entry when selection starts and closing selection on `popstate`.

**Entries**: `useRemoveEntries()` runs `delete from entries where id in (…)` as one request. It is optimistic over `entryKeys.day(day)` and rolls back on error. Undo calls a bulk insert of the same rows. Both invalidate the summary keys, as `removeEntry` does.

**Foods**:
- A migration adds `remove_foods(ids uuid[]) returns table (food_id uuid, outcome text)` (`'archived'` or `'deleted'`), which is security invoker so RLS applies. In one transaction it archives each Food that has Entries and deletes the rest.
- `restore_foods(ids uuid[])` clears `archived_at`. Undo inserts the deleted rows back with their original ids. If a re-created Food now clashes with a Food added since (spec 003 AC-9), the user sees that error.
- `useRemoveFoods()` updates the `foods` cache optimistically and invalidates `foodKeys` and `summaryKeys.all`.
- The confirmation counts come from `useFoodEntryCounts`, as the single-remove sheet does. The server still decides (AC-7).

## Test plan

- Vitest:
  - `selectionReducer` (AC-2, AC-3, AC-4).
  - The long-press decision function, covering hold, tap and move-cancels (AC-1).
  - The confirmation wording for mixed, archive-only and delete-only selections (AC-6).
  - Optimistic bulk-remove and rollback cache helpers (AC-5, AC-6).
- pgTAP:
  - `remove_foods` archives Foods with Entries and deletes the rest.
  - `remove_foods` is atomic.
  - One User can't remove another's Foods (AC-7).
  - `restore_foods` isolation.
- Testing Library: the selection bar's states, with tap toggling rather than opening the edit sheet (AC-2).
- Playwright (Pixel 7, touch):
  - Long-press an Entry → select two more → **Delete** → **Undo** restores all three (AC-1, AC-5).
  - Long-press a Food → search → **Select all** → **Delete** → the confirmation shows the split → confirm → the Food List and Archived Foods are correct → **Undo** (AC-4, AC-6).
  - Android back leaves selection mode without leaving the screen (AC-3).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | Selection mode on a Day's Entry list (`selectionReducer`, `useLongPress`, `SelectionBar`) and bulk delete of Entries with Undo | AC-1, AC-2, AC-3, AC-5 | [#73](https://github.com/streetlampsalad/calories-counter/issues/73) |
| 2 | `remove_foods` and `restore_foods` database functions with pgTAP | AC-7 | [#74](https://github.com/streetlampsalad/calories-counter/issues/74) |
| 3 | Selection mode on the Foods screen with search, **Select all**, and bulk remove with confirmation and Undo | AC-1, AC-2, AC-3, AC-4, AC-6 | [#75](https://github.com/streetlampsalad/calories-counter/issues/75) |

## Open questions

The owner accepted every default below on 2026-11-04; treat them as decisions.

- **Should deleting Entries in bulk ask for confirmation?** No. Undo for 5 seconds, matching a single remove.
- **Should Undo also re-create Foods that were deleted for good?** Yes, with their original ids.
- **Should the floating Add buttons hide during selection?** Yes, so **Delete** in the bar is the only action in reach.
