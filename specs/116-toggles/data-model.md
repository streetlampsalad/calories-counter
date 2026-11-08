# Data model: Toggles

All changes are additive (ADR 0003's rule that migrations work with the deployed app).

## `allowed_emails.is_owner` (new column)

`boolean not null default false`. Set by hand in each environment, like the Allowed Emails themselves; the table stays unreachable through the API.

## `public.toggles`

| Column | Type | Notes |
|---|---|---|
| `key` | `text` primary key | `check (key ~ '^feature-[0-9]+$')`, the Feature Issue number |
| `title` | `text not null` | `check (length(btrim(title)) between 1 and 80)` |
| `state` | `text not null default 'testing'` | `check (state in ('testing', 'live', 'removed'))` |
| `created_at`, `updated_at` | `timestamptz not null default now()` | `updated_at` kept by `public.set_updated_at()` |

- RLS: `authenticated` may `select` every row. No insert, update or delete grant: Toggles are added and moved by migrations (and by Feature #115's functions).
- Trigger `toggles_state_moves_forward` (before update): refuses any change of `state` other than `testing` → `live` and `testing` → `removed`, with SQLSTATE `23514`.

## `public.toggle_overrides`

| Column | Type | Notes |
|---|---|---|
| `toggle_key` | `text not null references toggles (key) on delete cascade` | |
| `user_id` | `uuid not null default auth.uid() references auth.users (id) on delete cascade` | |
| `enabled` | `boolean not null` | |
| `updated_at` | `timestamptz not null default now()` | |

Primary key `(toggle_key, user_id)`.

- RLS, all `to authenticated`: select own rows (`user_id = auth.uid()`); insert and update own rows `with check (user_id = auth.uid() and public.can_switch_toggle(toggle_key))`; delete own rows.

## Functions

| Function | Security | Returns |
|---|---|---|
| `public.is_owner()` | `definer`, `search_path = ''` | whether the caller's `email` claim matches an Allowed Email with `is_owner` |
| `public.can_try_toggle(key text)` | `invoker` | `public.is_owner()` today; Feature #114 replaces it to add the requester |
| `public.can_switch_toggle(key text)` | `invoker` | the Toggle exists, is in Testing, and `can_try_toggle(key)` |
| `public.toggle_is_on(key text)` | `invoker`, `stable` | `true` when Live, or in Testing with `can_try_toggle` and the caller's override `enabled`; otherwise `false`, including no such Toggle |
| `public.my_toggles()` | `invoker`, `stable` | a row per Toggle: `key`, `title`, `state`, `is_on` (from `toggle_is_on`), `can_switch` (from `can_switch_toggle`) |

`execute` on all five is revoked from `public` and `anon` and granted to `authenticated`.
