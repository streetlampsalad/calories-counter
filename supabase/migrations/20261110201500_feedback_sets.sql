-- Feedback sets (spec 193, Slice 1): a Round keeps its Requester's feedback as 1 to 5 sets, each an
-- enhancement or a bug, in the order sent. Additive only (ADR 0003): `feedback` still holds the first
-- set's text, and the `feedback text` overload of start_feature_request_round is untouched, so the
-- app deployed before this migration keeps working. The Rounds policy (a Requester reads their own
-- Rounds) covers the new column.

alter table public.feature_request_rounds
  add column sets jsonb
  check (sets is null or (jsonb_typeof(sets) = 'array' and jsonb_array_length(sets) between 1 and 5));

-- As the live `feedback text` overload (20261108090000_feature_request_decisions.sql), but from sets:
-- it refuses anything but 1 to 5 sets, each with a category of enhancement or bug and a text of 10 to
-- 4,000 characters after trimming, raising invalid_feedback_sets. Starts a Round on the Requester's
-- own request only once it has been Ready to try and is Ready to try again (or its last Round was
-- declined), never on a decided request, with its Toggle still in Testing. The request goes back to
-- Submitted in the same transaction as the open-request check, under the same lock as new requests.
-- Returns no Round when it may not start one, and otherwise what the request was, so
-- undo_feature_request_round can put it back. Only the server (service role) may call it.
create function public.start_feature_request_round(request_id uuid, requester_id uuid, sets jsonb)
returns table (
  round_id uuid,
  round_number integer,
  goal text,
  feature_issue integer,
  previous_stage text,
  previous_stage_changed_at timestamptz,
  previous_latest_comment text,
  previous_ready_note text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.feature_requests;
  checked jsonb;
begin
  -- Checked in two steps, so the array functions below only ever see an array.
  if start_feature_request_round.sets is null
    or jsonb_typeof(start_feature_request_round.sets) <> 'array'
  then
    raise exception 'invalid_feedback_sets' using errcode = '22023';
  end if;
  if jsonb_array_length(start_feature_request_round.sets) not between 1 and 5
    or exists (
      select 1 from jsonb_array_elements(start_feature_request_round.sets) as s (value)
      where jsonb_typeof(s.value) <> 'object'
        or jsonb_typeof(s.value -> 'category') is distinct from 'string'
        or s.value ->> 'category' not in ('enhancement', 'bug')
        or jsonb_typeof(s.value -> 'text') is distinct from 'string'
        or char_length(btrim(s.value ->> 'text')) not between 10 and 4000
    )
  then
    raise exception 'invalid_feedback_sets' using errcode = '22023';
  end if;

  -- Only the two fields, trimmed, in the order sent.
  select jsonb_agg(
    jsonb_build_object('category', s.value ->> 'category', 'text', btrim(s.value ->> 'text'))
    order by s.position
  ) into checked
  from jsonb_array_elements(start_feature_request_round.sets) with ordinality as s (value, position);

  perform pg_advisory_xact_lock(hashtext('feature_requests:' || requester_id::text));

  select r.* into request
  from public.feature_requests r
  join public.toggles t on t.key = 'feature-' || r.feature_issue
  where r.id = start_feature_request_round.request_id
    and r.user_id = start_feature_request_round.requester_id
    and r.withdrawn_at is null
    and r.first_ready_at is not null
    and r.stage in ('ready_to_try', 'not_going_ahead')
    and r.decision is null
    and t.state = 'testing'
  for update of r;
  if not found then
    return;
  end if;

  if (
    select count(*) from public.feature_requests r
    where r.user_id = requester_id
      and r.id <> request.id
      and r.withdrawn_at is null
      and r.stage in ('submitted', 'being_reviewed', 'planning', 'building', 'waiting_for_owner')
  ) >= 2 then
    raise exception 'feature_request_limit' using errcode = '23514';
  end if;

  insert into public.feature_request_rounds (request_id, feedback, sets)
  values (request.id, checked -> 0 ->> 'text', checked)
  returning id into round_id;

  update public.feature_requests r
  set stage = 'submitted', stage_changed_at = now(), latest_comment = null, ready_note = null
  where r.id = request.id;

  -- The request's own build is Round 1.
  round_number := 1 + (select count(*)::integer from public.feature_request_rounds x where x.request_id = request.id);
  goal := request.goal;
  feature_issue := request.feature_issue;
  previous_stage := request.stage;
  previous_stage_changed_at := request.stage_changed_at;
  previous_latest_comment := request.latest_comment;
  previous_ready_note := request.ready_note;
  return next;
end;
$$;

revoke all on function public.start_feature_request_round(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_feature_request_round(uuid, uuid, jsonb) to service_role;
