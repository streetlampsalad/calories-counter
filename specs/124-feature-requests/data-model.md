# Data model: Feature Requests

All changes are additive. Users read; only the server (service role) writes.

## `public.feature_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` primary key `default gen_random_uuid()` | goes into the Issue's `### Requested by` |
| `user_id` | `uuid not null references auth.users (id) on delete cascade` | the Requester |
| `goal` | `text not null` | `check (char_length(btrim(goal)) between 10 and 2000)` |
| `problem` | `text` | `check (char_length(problem) <= 4000)` |
| `details` | `text` | `check (char_length(details) <= 4000)` |
| `feature_issue` | `integer unique` | null only between insert and the Issue being created |
| `spec_issue` | `integer` | from the sync |
| `stage` | `text not null default 'submitted'` | `check (stage in ('submitted', 'being_reviewed', 'planning', 'building', 'waiting_for_owner', 'ready_to_try', 'not_going_ahead'))` |
| `latest_comment` | `text` | first line of the latest agent comment, at most 200 characters |
| `ready_note` | `text` | the spec's `## Ready to try` section, at most 2,000 characters |
| `withdrawn_at` | `timestamptz` | set by Withdraw; a withdrawn request ignores later syncs |
| `created_at`, `stage_changed_at` | `timestamptz not null default now()` | |

Index on `user_id`.

- RLS: `authenticated` may `select` their own rows (`user_id = auth.uid()`). No insert, update or delete grant for `anon` or `authenticated`.
- Trigger `feature_requests_open_limit` (before insert): takes `pg_advisory_xact_lock(hashtext('feature_requests:' || new.user_id))` so two submits at once cannot both pass, then refuses a third request at an open stage (`submitted`, `being_reviewed`, `planning`, `building`, `waiting_for_owner`, not withdrawn) for the same User, with SQLSTATE `23514` and message `feature_request_limit`.

"Live for everyone" and "Removed" are never stored: the app shows them when the Toggle `feature-<feature_issue>` is Live or Removed. "Withdrawn" is `withdrawn_at is not null`.

## Functions

| Function | Security | Purpose |
|---|---|---|
| `public.other_feature_requests()` | `definer`, `search_path = ''` | rows of other Users with `stage` from `submitted` to `ready_to_try` (not `not_going_ahead`) and not withdrawn: `id`, `goal`, `stage`, `feature_issue`, `created_at`; never `user_id`, `problem` or `details` |
| `public.feature_requests_ahead(request_id uuid)` | `definer` | how many requests of any User at `submitted` or `being_reviewed`, not withdrawn, were created before it; null unless the caller owns `request_id` |
| `public.can_try_toggle(key text)` | `invoker` | replaced (Slice 3): `public.is_owner()` or the caller has a Feature Request, not withdrawn, whose `'feature-' \|\| feature_issue = key` |
| `public.apply_feature_request_sync(updates jsonb)` | `definer`, `service_role` only | for each `{feature_issue, stage, spec_issue, latest_comment, ready_note}`: updates the matching request that is not withdrawn, sets `stage_changed_at` when the stage changes, and returns the rows whose stage changed into `ready_to_try` or `not_going_ahead` (id, user_id, goal, latest_comment), so each notification is decided once |

## Seed (local and CI only)

Toggle `feature-114` "Feature requests" stays off for e2e Users unless a test turns it on for the seeded Owner, `liv`.
