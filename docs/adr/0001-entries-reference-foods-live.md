# Entries reference Foods live; editing a Food rewrites history

An Entry stores only the Food it refers to and a Quantity, never a copy of the calories. Every Daily Total is computed from the Food's *current* calories per Portion, so correcting a Food retroactively corrects every past Day. We chose this over snapshotting calories onto each Entry because the main reason to edit a Food is fixing a mistake, and the user wants history to follow the fix.

## Consequences

- A Food that any Entry refers to cannot be deleted, only Archived. A Food with no Entries may be hard-deleted.
- If a real-world food genuinely changes (a café enlarges its cup), the User must create a new Food rather than edit the old one, or history will be wrong.
- Totals are derived, not stored, so there is no recalculation job to keep in sync. Any caching of totals must be invalidated on Food edits.
