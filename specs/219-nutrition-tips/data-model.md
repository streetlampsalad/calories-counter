# Data model: Nutrition tips for last week

Additive only (ADR 0003): the deployed app keeps working before and after each migration.

## Toggle (Slice 1)

`insert into public.toggles (key, title) values ('feature-218', 'Nutrition tips') on conflict do nothing;` (Testing by default).

## Allowance (Slice 1)

No schema change: the route calls the existing `public.increment_ai_usage('tips', 3)`, which counts per User per Sydney Day and refuses past the limit.

## `public.nutrition_tips` (Slice 2, new)

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | `not null default auth.uid() references auth.users (id) on delete cascade` |
| `week_start` | `date` | `not null`; the first Day of the week the tips cover |
| `tips` | `jsonb` | `not null`; an array of 1–3 `{ "nutrient": text, "tip": text }`, checked by `case when jsonb_typeof(tips) = 'array' then jsonb_array_length(tips) between 1 and 3 else false end` (a CASE, because `and` need not stop at the first false and `jsonb_array_length` errors on a non-array) |
| `created_at` | `timestamptz` | `not null default now()` |

Primary key `(user_id, week_start)`: one set per User per week; Ask again upserts.

### RLS

- `alter table public.nutrition_tips enable row level security;`
- `revoke all on public.nutrition_tips from anon, authenticated; grant select, insert, update, delete on public.nutrition_tips to authenticated;`
- Policies, each `to authenticated`, all on `user_id = (select auth.uid())`: "Users read their own Nutrition tips" (select), "Users add their own Nutrition tips" (insert, `with check`), "Users replace their own Nutrition tips" (update, `using` and `with check`), "Users remove their own Nutrition tips" (delete).

The route writes with the User's own client, after the allowance and Gemini succeed. A User could write their own row directly; that only changes what they see themselves, and the card parses each kept row with the tips schema, treating one that does not parse as no tips.

## pgTAP (`029_nutrition_tips.test.sql`)

- RLS enabled with the four policies; `000_guardrails` passes.
- A User reads, adds, replaces and removes their own rows and none of another User's (US2.4).
- An empty array, four tips, or a non-array `tips` is rejected; `week_start` is `date` (US2.5).
- The primary key refuses a second row for the same User and week.
