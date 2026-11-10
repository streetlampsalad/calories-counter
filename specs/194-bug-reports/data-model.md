# Data model: Report a bug from inside the app

Additive only (ADR 0003): the app deployed before the migration keeps working. One migration, in Slice 1.

## Toggle

`insert into public.toggles (key, title) values ('feature-192', 'Report a bug') on conflict do nothing;` (Testing by default).

## `public.bug_reports` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key, `default gen_random_uuid()`; written into the Issue's `### Requested by` |
| `user_id` | `uuid` | `not null references auth.users (id) on delete cascade`; indexed with `created_at` |
| `bug_issue` | `integer` | `unique`; null only between the row being added and its Issue being created |
| `created_at` | `timestamptz` | `not null default now()` |

No User-written text is stored (spec D11).

### RLS

- `alter table public.bug_reports enable row level security;`
- `revoke all on public.bug_reports from anon, authenticated; grant select on public.bug_reports to authenticated;`
- Policy "Users read their own Bug reports": `for select to authenticated using (user_id = (select auth.uid()))`.
- No insert, update or delete grants for `authenticated`: the server writes with the service role (spec D12).

### Limit

`public.bug_reports_daily_limit()`, a `before insert` trigger function (`set search_path = ''`, execute revoked from `public, anon, authenticated`): takes `pg_advisory_xact_lock(hashtext('bug_reports:' || new.user_id::text))`, then raises `bug_report_limit` with errcode `23514` when the User already has 5 rows with `created_at > now() - interval '24 hours'`. Modelled on `feature_requests_open_limit` in `20261108031743_feature_requests.sql`.

## pgTAP (`027_bug_reports.test.sql`)

- The table has RLS and the policy; `000_guardrails` passes.
- A User reads their own rows and none of another User's; `authenticated` cannot insert, update or delete.
- The sixth insert within 24 hours raises `bug_report_limit`; a row older than 24 hours does not count.
- The Toggle `feature-192` exists in Testing.

## Slice 3: outcomes

New nullable columns on `public.bug_reports` (the deployed app never selects them):

| Column | Type | Notes |
|---|---|---|
| `outcome` | `text` | `check (outcome in ('sent', 'being_fixed', 'waiting_for_owner', 'fixed', 'not_going_ahead'))`; null reads as Sent |
| `issue_title` | `text` | `check (char_length(issue_title) <= 256)`; the public Issue title |
| `latest_comment` | `text` | `check (char_length(latest_comment) <= 2000)`; the reason for Not going ahead |
| `outcome_changed_at` | `timestamptz` | set when `outcome` changes |

The select policy already limits reads to the User who sent it.

`public.apply_bug_report_sync(updates jsonb)`: `security definer`, `set search_path = ''`, execute granted to `service_role` only. For each `{ id, bug_issue, outcome, issue_title, latest_comment }` it updates the row whose `id` and `bug_issue` both match, in one `update … returning`, and returns the rows whose outcome changed into `fixed` or `not_going_ahead` (with `user_id`, `id`, `new_outcome`, `issue_title`, `latest_comment`), so a repeated sync notifies nobody (spec D20).

pgTAP (`028_bug_report_sync.test.sql`): only `service_role` can execute it; a mismatched `bug_issue` changes nothing; it returns a row only on a change into Fixed or Not going ahead and not on a repeat; another User reads none of the new columns.
