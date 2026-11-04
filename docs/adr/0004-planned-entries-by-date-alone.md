# Planned Entries are told apart by their Day alone

A Planned Entry is simply an Entry whose Day is after today; there is no `planned` flag and no step to confirm it was eaten. When its Day arrives it counts like any other Entry, so a breakfast planned for today is in today's Daily Total from midnight, eaten or not. We chose this over a flag the User ticks off because it needs no schema change, keeps logging at two taps, and summaries already stop at today, so they exclude Planned Entries for free.

## Considered Options

- **A `planned` flag, ticked when eaten**: tells planned from eaten exactly, even on past Days, but adds a migration, a tap per planned meal, and a state every summary must filter on.

## Consequences

- If plans change, the User edits or removes the Entry; an unremoved plan reads as eaten once its Day arrives.
- Anything that should count only eaten food (summaries, the picker's Recent row and ordering) must bound its Days at today, not rely on the data.
