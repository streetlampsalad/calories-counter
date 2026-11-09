# Feature Specification: Meal times

**Spec issue**: #174

**Feature**: #173

**Created**: 2026-11-09

**Status**: Draft

**Depends on**: `docs/specs/008-daily-logging.md` (Entries and the picker), `docs/specs/013-planned-entries.md` (Planned Entries), `specs/168-settings-categories/spec.md` (Try features lists the Toggle)

**ADRs**: [0001](../../docs/adr/0001-entries-reference-foods-live.md) (totals are computed, never stored), [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (every new Feature ships behind a Toggle)

**Input**: Feature description: "I want to be able to categorise my food by meal time - breakfast, lunch, dinner and snacks. When I add a food to my daily diary I want to tag it was one of those meal times."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tag an Entry with a Meal time when adding it (Priority: P1)

With the Toggle on for them, a User adding a Food to a Day sees a row of four chips (Breakfast, Lunch, Dinner, Snack) in the picker. For today the chip that fits the time of day is already chosen; tapping a chip chooses it, and tapping the chosen chip clears it. The Entry is saved with that Meal time and its row shows it.

**Why this priority**: it is the whole request; seeing and changing the tag build on it.

**Independent Test**: Testing Library covers the chips, the default and the saved value; pgTAP covers the column; Playwright adds an Entry with a chosen Meal time.

**Acceptance Scenarios**:

1. **Given** the Toggle is on, **When** the User opens the picker, **Then** four chips Breakfast, Lunch, Dinner and Snack are shown, each at least 44 px high, and none is chosen when the Day is not today.
2. **Given** the Toggle is on and the Day is today, **When** the picker opens, **Then** the chip for the time of day on the phone is chosen: Breakfast before 10:30, Lunch from 10:30 to 14:59, Snack from 15:00 to 16:59, Dinner from 17:00.
3. **Given** a chip is chosen, **When** the User taps another chip, **Then** only that chip is chosen; **When** they tap the chosen chip, **Then** none is chosen.
4. **Given** a chip is chosen, **When** the User picks a Food and a Quantity, **Then** the Entry is added with that Meal time, shown on its row, immediately (optimistic), and rolls back with "Couldn't save that" on failure.
5. **Given** no chip is chosen, **When** the User adds an Entry, **Then** it is saved with no Meal time and behaves exactly as today.
6. **Given** the Toggle is off, loading or failed, **When** the User opens the picker, **Then** there are no chips and Entries are saved with no Meal time.
7. **Given** the Day is after today (a Planned Entry), **When** the User adds an Entry, **Then** the chips work the same and none is chosen by default.
8. **Given** an Entry has a Meal time, **When** its Food or Quantity changes, **Then** the Meal time is kept.
9. **Given** the database, **When** a value other than breakfast, lunch, dinner or snack is written to an Entry's Meal time, **Then** it is rejected; an Entry may have none.

---

### User Story 2 - See the Day grouped by Meal time (Priority: P2)

With the Toggle on, the Day's Entries are grouped under Breakfast, Lunch, Dinner and Snacks headings, each showing its own calories, followed by Entries with no Meal time under "Other". A heading appears only when it has Entries.

**Why this priority**: tagging is only useful once it shows.

**Independent Test**: Testing Library on the grouping logic and the list; Playwright adds Entries to two Meal times and reads the groups.

**Acceptance Scenarios**:

1. **Given** the Toggle is on and a Day has Entries in more than one Meal time, **When** the User opens the Day, **Then** Entries are grouped in the order Breakfast, Lunch, Dinner, Snacks, Other, each group newest first.
2. **Given** a group, **Then** its heading shows the sum of its Entries' Quantity times current Food Calories (never stored), and the Daily Total is unchanged.
3. **Given** a Day has Entries but none has a Meal time, **When** it is opened, **Then** it looks as it does today, with no headings.
4. **Given** a Meal time has no Entries on that Day, **Then** its heading is not shown.
5. **Given** the Toggle is off, loading or failed, **When** the Day opens, **Then** it is the single newest-first list as today and no Meal time is shown.

---

### User Story 3 - Change an Entry's Meal time later (Priority: P3)

In the sheet that opens when the User taps an Entry, the same four chips show its Meal time; the User can change or clear it.

**Why this priority**: fixes a wrong guess without removing the Entry.

**Independent Test**: Testing Library on the edit sheet; Playwright changes a tag and sees the Entry move group.

**Acceptance Scenarios**:

1. **Given** the Toggle is on, **When** the User taps an Entry, **Then** the sheet shows the four chips with the Entry's Meal time chosen, or none.
2. **Given** the sheet is open, **When** the User chooses, changes or clears a chip, **Then** the Entry updates immediately, moves to the right group, and rolls back with "Couldn't save that" on failure.
3. **Given** the Toggle is off, **When** the User taps an Entry, **Then** the sheet is as today.

### Edge Cases

- **Entries from before the Feature** have no Meal time and appear under "Other" (only when the Day has some tagged Entry).
- **Turning the Toggle off** hides Meal times but keeps them stored; turning it on again shows them.
- **Offline**: behaves like logging does today (the write fails and rolls back).
- **Time of day** comes from the phone's clock and is used only to pre-choose a chip; it is never stored.
- **Undo after removing** an Entry restores its Meal time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Where Toggle `feature-173` is on, the picker MUST offer the four Meal times and save the chosen one on the Entry.
- **FR-002**: An Entry MUST have at most one Meal time, and MAY have none.
- **FR-003**: Where the Toggle is on, the Day MUST group Entries by Meal time with per-group calories computed from Entries and current Food Calories.
- **FR-004**: Where the Toggle is on, a User MUST be able to change or clear an Entry's Meal time.
- **FR-005**: Where the Toggle is off, loading or failed, the app MUST behave exactly as today.
- **FR-006**: Chips and controls MUST be at least 44 px high; copy MUST be Australian English.
- **FR-007**: A User MUST NOT be able to read or change another User's Entries' Meal times (existing Entry RLS).

### Key Entities

- **Meal time**: breakfast, lunch, dinner or snack. An optional attribute of an Entry, not a table. See `CONTEXT.md`.

## Success Criteria *(mandatory)*

- **SC-001**: A User can add an Entry with a Meal time in no more taps than today when the pre-chosen chip is right.
- **SC-002**: Deploying this spec changes nothing any User sees until the Toggle is on for them.
- **SC-003**: Daily Totals and summaries are identical with the Toggle on or off.

## Out of Scope

- Meal time breakdowns in Summaries or Insights, or per-Meal-time Goals.
- Custom Meal times, renaming or reordering them.
- Tagging many Entries at once, or tagging the Food itself.
- Remembering a Meal time per Food.

## Ready to try

When you add something to your diary you now see four buttons: Breakfast, Lunch, Dinner and Snack. Tap one to tag it (for today the right one is already chosen for the time of day), or tap it again to clear it. Your day then lists food under those headings with the calories for each, and you can change a tag by tapping an entry. Entries you made before stay untagged under "Other".

Guesses made: the times of day used to pre-choose a button (Breakfast before 10:30, Lunch until 3 pm, Snack until 5 pm, Dinner after), and that Summaries do not split by meal.

## Assumptions

- "Snack" in the chip, "Snacks" as a group heading.
- Four fixed Meal times are enough for a few friends.
- Gated with its own Toggle, `feature-173`, as ADR 0008 requires.

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | Name for the concept? | **Meal time**; `CONTEXT.md` avoids "meal" for Entry and Food, so the new term is Meal time and is added to the glossary | "Meal" (clashes with the glossary's avoid list) | high |
| D2 | Where is it stored? | A nullable `meal_time` text column on `entries` with a check for the four values | A separate table (over-built); tagging the Food (the same Food is eaten at different times) | high |
| D3 | Required or optional? | Optional; existing and untagged Entries stay valid | Required with a default (rewrites existing data, breaks the deployed app's inserts) | high |
| D4 | Default chip? | Pre-chosen from the phone's clock for today only (US1.2); none for other Days | Always none (more taps); remember last choice (surprising across Days) | medium |
| D5 | When is the tag chosen? | In the picker before the Quantity tap, so adding is still one tap on a Quantity | A second step after the Quantity (slower) | medium |
| D6 | Grouping on the Day? | Headings only when at least one Entry is tagged (US2.3); Other last | Always show four headings (empty clutter) | medium |
| D7 | Do totals change? | No: per-group sums are computed on the client like the Daily Total (ADR 0001) | Storing subtotals | high |
| D8 | Migration safety? | Additive nullable column; the deployed app neither writes nor selects it | Backfill (no need) | high |
| D9 | Slices? | Three, by user story: tag on add (with Toggle and migration), group the Day, edit the tag | One big Slice (more than one pull request's worth) | medium |
| D10 | Planned Entries? | Taggable like any Entry (US1.7) | Excluding them (inconsistent) | high |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | No | | |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | No | The migration only adds a nullable column and a Toggle row | |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | No | Playwright, Testing Library and pgTAP cover it | |
| Touches sign-in, RLS policies or what one User can see of another | No | Existing Entry policies cover the new column unchanged | |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | No | | |
| Contradicts an ADR or needs a new one | No | Follows ADR 0001 and 0008; spec 008 listed meal grouping as out of scope at the time, which this supersedes | |
| Size L or XL | No | Three small Slices on existing Entry code | |

**Size**: M

**Human review**: Not needed
