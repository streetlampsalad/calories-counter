# Data model: Feedback, Ready and Remove

All changes are additive (`create or replace` keeps every existing answer for requests with no Rounds).

## `public.feature_request_rounds` (Slice 1)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` primary key `default gen_random_uuid()` | |
| `request_id` | `uuid not null references feature_requests (id) on delete cascade` | |
| `feedback` | `text not null` | `check (char_length(btrim(feedback)) between 10 and 4000)` |
| `feature_issue` | `integer unique` | null only between insert and the Issue being created |
| `created_at` | `timestamptz not null default now()` | |

- RLS: `authenticated` may `select` Rounds of their own requests (`exists (select 1 from feature_requests r where r.id = request_id and r.user_id = auth.uid())`). No writes through the API.

## `public.feature_requests` new columns

| Column | Type | Slice | Notes |
|---|---|---|---|
| `first_ready_at` | `timestamptz` | 1 | set by a trigger the first time the stage becomes `ready_to_try`; once set, Withdraw is refused (D12) |
| `decision` | `text check (decision in ('ready', 'remove'))` | 2 | set with the Toggle's state change |
| `cleanup_issue` | `integer` | 2 | the Chore that deletes the Toggle checks or the feature |
| `testing_reminder_sent_at` | `timestamptz` | 4 | the last 14-day reminder |

## Functions

| Function | Change | Slice |
|---|---|---|
| `public.apply_feature_request_sync(updates jsonb)` | `create or replace`: finds a request by its own Feature Issue or one of its Rounds', applies an update only when that Issue is the request's newest (its newest Round's, else its own), and sets `first_ready_at` on the first `ready_to_try` | 1 |
| `public.start_feature_request_round(request_id, requester_id, feedback)` | new, `definer`, `service_role` only: under the open-request lock, checks the request is the Requester's, not withdrawn, has been Ready to try and is at `ready_to_try` (or `not_going_ahead`, D13), and its Toggle is in Testing; raises `feature_request_limit` when 2 others are open; inserts the Round and puts the request back at `submitted`. Returns `round_id`, `round_number`, `goal`, `feature_issue` and the request's previous `stage`, `stage_changed_at`, `latest_comment` and `ready_note`, or no row | 1 |
| `public.undo_feature_request_round(round_id, stage, stage_changed_at, latest_comment, ready_note)` | new, `service_role` only: deletes a Round and puts its request back as `start_feature_request_round` found it, in one statement | 1 |
| `public.can_try_toggle(key text)` | `create or replace`: the Requester may try while `first_ready_at is not null` (not only at `ready_to_try`), until withdrawn | 1 |
| `public.decide_feature_request(request_id, requester_id, decision, cleanup_issue)` | new, `definer`, `service_role` only: under the request's row lock, checks it is the Requester's, not withdrawn or decided, has been Ready to try and is at `ready_to_try` (or `not_going_ahead`, D13); moves its Toggle from Testing to Live (`ready`) or Removed (`remove`) and records `decision` and `cleanup_issue`. False, changing nothing, otherwise | 2 |
| `public.due_testing_reminders()` | new, `definer`, `service_role` only: requests at `ready_to_try` whose `stage_changed_at` is 14 days old or more, Toggle in Testing, not withdrawn, and `testing_reminder_sent_at` null or older than `stage_changed_at`; sets `testing_reminder_sent_at = now()` in the same update and returns `request_id`, `requester_id`, `goal_text` | 4 |

The open-request limit (spec 124) counts a request whose Round is being worked on, because the request's own stage moves back to `submitted`.
