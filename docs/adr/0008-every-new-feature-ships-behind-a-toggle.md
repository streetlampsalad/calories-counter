# Every new feature ships behind a Toggle

Supersedes two rules kept in [ADR 0007](0007-spec-driven-pull-requests-gated-by-risk.md) from ADR 0003: "a feature stays unreachable until its last Slice lands" and "there are no feature flags".

Every new Feature ships behind its own Toggle, off for everyone. Its first Slice adds the Toggle in a migration, keyed by the Feature Issue number (`feature-<n>`), and every Slice gates its new behaviour on that Toggle, so each merge can reach production without changing what anyone sees. While the Toggle is in **Testing**, the Users allowed to try it (the Owner, and later the User who requested it) turn it on for themselves and try the feature in production. It then goes **Live** (on for everyone, after which a Chore deletes the Toggle checks) or is **Removed** (off for everyone, after which a Chore deletes the feature's code). Toggles live in Supabase, next to the data RLS already guards, and are read through TanStack Query in the browser and through one helper on the server.

We chose this so a feature can be tried by one real User on real data before everyone gets it, and pulled back with a database write instead of a deploy. The old rule kept half-built features unreachable, but it made the last Slice ship the whole feature to every User at once, with no way to try it first or turn it off.

## Considered Options

- **Vercel Flags or Edge Config**: a second place for state, a new integration and secret, and per-User overrides that would have to mirror Supabase's Users.
- **Environment variables**: one value for everyone, so no per-User Testing, and changing one needs a deploy.
- **Keep "unreachable until the last Slice"**: no way to try a feature in production before everyone has it.

## Consequences

- **Backwards compatible** means: with a Toggle off, the app behaves exactly as it did before the Feature's first Slice. Migrations stay additive while a Toggle is in Testing; a column or table is dropped only by the removal Chore of a Removed Toggle, which the merge gate flags for Human review as a destructive migration.
- A Toggle that is missing, still loading or failed to load counts as off, so an error never shows half a feature.
- New routes and route handlers check their Toggle on the server and answer 404 while it is off for the caller.
- A Toggle's state only moves forward: Testing to Live, or Testing to Removed. A feature that is Live and needs to go is a new Feature.
- Toggle checks are temporary code. A Toggle that is Live or Removed always gets a Chore that deletes its checks or its feature.
- The Owner is marked by `allowed_emails.is_owner`, set by hand in each environment like the Allowed Emails themselves.
- Bugs, Chores and Spikes do not get Toggles; they change no behaviour, or fix behaviour that is already wrong.
