# Feature Specification: Meal headings that stand out

**Spec issue**: #187

**Feature**: #186 (Round 2 of #173)

**Created**: 2026-11-10

**Status**: Draft

**Depends on**: `specs/174-meal-times/spec.md` (the grouped Day), `specs/135-feedback-ready-remove/spec.md` (Rounds)

**ADRs**: [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (the change stays behind the existing Toggle `feature-173`; no new Toggle)

**Input**: Feedback on Meal times: "The meal headings need to be a bigger font then the food entry so it's clearly a heading."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Meal headings read as headings (Priority: P1)

With Toggle `feature-173` on, the Day's group headings (Breakfast, Lunch, Dinner, Snacks, Other) are set in a larger, bolder type than the Entry rows under them, so the eye finds each Meal time first. The heading's calories stay on the same line, in a quieter weight.

**Why this priority**: it is the whole feedback.

**Independent Test**: Testing Library checks the heading's type classes against the Entry row's; Playwright checks the rendered font size of a heading is larger than that of an Entry's name.

**Acceptance Scenarios**:

1. **Given** the Toggle is on and a Day has tagged Entries, **When** the Day is opened, **Then** each Meal time heading's font size is larger than the font size of the Entry names beneath it.
2. **Given** a heading, **Then** its name is semibold or bolder and its calories are in the muted colour at a lighter weight, on the same line.
3. **Given** the Toggle is off, loading or failed, or no Entry has a Meal time, **When** the Day is opened, **Then** there are no headings, as today.
4. **Given** a Day with groups, **Then** the headings keep their accessible role (level 3 heading) and name, and the Daily Total and per-group calories are unchanged.
5. **Given** a 360 px wide phone, **When** a heading has a long calorie figure, **Then** nothing wraps or overflows, and the heading has comfortable space above it (at least 16 px) to separate it from the previous group.

### Edge Cases

- **Dark mode** uses the same classes with theme colours, so contrast holds in both.
- **Leaving rows** (a removed Entry collapsing) behave as before.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Where Toggle `feature-173` is on, a Meal time heading MUST be set larger than an Entry's name and at least semibold.
- **FR-002**: Where the Toggle is off, loading or failed, the app MUST behave exactly as today.
- **FR-003**: The change MUST NOT alter grouping, order, totals or accessibility roles.

### Key Entities

None new. **Meal time** is in `CONTEXT.md`.

## Success Criteria *(mandatory)*

- **SC-001**: At a glance on a 360 px phone, a User can tell a heading from an Entry row without reading.
- **SC-002**: Nothing changes for any User until the Toggle is on for them.

## Out of Scope

- Collapsible groups, sticky headings, or new heading content.
- Changing the size of Entry rows.

## Ready to try

On your day, the headings Breakfast, Lunch, Dinner, Snacks and Other are now bigger and bolder than the food listed under them, with that heading's calories beside it in a lighter style.

Guesses made: how much bigger (about one size up from the food names) and keeping the calories on the same line as the heading.

## Assumptions

- Same Toggle, `feature-173`; a Round adds no Toggle (spec 135).
- "Bigger" means a larger text size and heavier weight, not a coloured band.

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | How to make it a heading? | Larger text (`text-lg`) and semibold, with more space above | Colour band or icon (heavier, riskier in dark mode) | high |
| D2 | Calories on the heading? | Keep on the same line, muted and normal weight | Hide or move them (loses information) | high |
| D3 | Schema or Toggle change? | None | A new Toggle (rounds reuse the original) | high |
| D4 | Slices? | One: a styling change in `entry-list.tsx` | Splitting (nothing to split) | high |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | No | | |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | No | No migration | |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | No | Testing Library and Playwright cover it | |
| Touches sign-in, RLS policies or what one User can see of another | No | | |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | No | | |
| Contradicts an ADR or needs a new one | No | | |
| Size L or XL | No | | |

**Size**: XS

**Human review**: Not needed
