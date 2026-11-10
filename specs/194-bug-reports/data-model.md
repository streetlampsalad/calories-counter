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
