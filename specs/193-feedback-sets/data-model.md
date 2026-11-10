# Data model: Several sets of feedback

Additive only (ADR 0003): the app deployed before the migration keeps working.

## `public.feature_request_rounds` new column (Slice 1)

| Column | Type | Notes |
|---|---|---|
| `sets` | `jsonb` | null for Rounds sent before this Feature. Otherwise an array of 1–5 objects `{ "category": "enhancement" \| "bug", "text": string }` in the order sent; `check (sets is null or (jsonb_typeof(sets) = 'array' and jsonb_array_length(sets) between 1 and 5))` |

The existing RLS policy (a Requester reads their own Rounds) covers it; no policy changes. `feedback` stays `not null`, 10–4,000 characters, and holds the first set's text.

## Functions

| Function | Change | Slice |
|---|---|---|
| `public.start_feature_request_round(request_id uuid, requester_id uuid, sets jsonb)` | new overload, `definer`, `service_role` only: validates each set (text 10–4,000 characters after trimming, category `enhancement` or `bug`, 1–5 sets; raises `invalid_feedback_sets` otherwise), then does what the live `feedback text` overload does (copy the version in `20261108090000_feature_request_decisions.sql`, which also refuses a request whose `decision` is set, not the original in `20261108080000`), storing `sets` and `feedback` = the first set's text. The old overload stays untouched | 1 |
