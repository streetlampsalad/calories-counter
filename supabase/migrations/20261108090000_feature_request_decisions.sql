-- It's ready and Remove it (spec 135, Slices 2 and 3): the Requester's decision, and the clean-up
-- Chore created for it. New nullable columns and a new function, so the deployed app is unaffected.

alter table public.feature_requests
  add column decision text check (decision in ('ready', 'remove')),
  add column cleanup_issue integer;

-- Records the Requester's decision on their own request, which has been Ready to try and is Ready to
-- try (or its last Round was declined, D13): its Toggle goes Live (ready) or Removed (remove), for
-- everyone, and the request remembers the Chore created for it. False, changing nothing, when the
-- request may not be decided or its Toggle is no longer in Testing; the server then closes the Chore
-- again (D4). Only the server (service role) may call it, after checking the caller.
create function public.decide_feature_request(
  request_id uuid,
  requester_id uuid,
  decision text,
  cleanup_issue integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.feature_requests;
begin
  if decide_feature_request.decision is null
    or decide_feature_request.decision not in ('ready', 'remove')
    or decide_feature_request.cleanup_issue is null then
    raise exception 'decide_feature_request needs a decision and its Chore' using errcode = '22023';
  end if;

  select r.* into request
  from public.feature_requests r
  where r.id = decide_feature_request.request_id
    and r.user_id = decide_feature_request.requester_id
    and r.withdrawn_at is null
    and r.first_ready_at is not null
    and r.stage in ('ready_to_try', 'not_going_ahead')
    and r.decision is null
  for update;
  if not found then
    return false;
  end if;

  update public.toggles t
  set state = case decide_feature_request.decision when 'ready' then 'live' when 'remove' then 'removed' end
  where t.key = 'feature-' || request.feature_issue
    and t.state = 'testing';
  if not found then
    return false;
  end if;

  update public.feature_requests r
  set decision = decide_feature_request.decision,
      cleanup_issue = decide_feature_request.cleanup_issue
  where r.id = request.id;
  return true;
end;
$$;

revoke all on function public.decide_feature_request(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.decide_feature_request(uuid, uuid, text, integer) to service_role;

-- As in Slice 1, but never on a decided request: a Round waiting on the lock while the other phone
-- marks it ready sees the decision, so no Round is built behind a Toggle that is no longer in Testing.
-- Starts a Round on the Requester's own request: only once it has been Ready to try and is Ready to
-- try again (or its last Round was declined, D13), with its Toggle still in Testing. The request goes
-- back to Submitted in the same transaction as the open-request check, under the same lock as new
-- requests, so feedback counts towards the 2 at a time. Returns no Round when it may not start one,
-- and otherwise what the request was, so undo_feature_request_round can put it back.
-- Only the server (service role) may call it, after checking the caller.
create or replace function public.start_feature_request_round(request_id uuid, requester_id uuid, feedback text)
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
begin
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

  insert into public.feature_request_rounds (request_id, feedback)
  values (request.id, start_feature_request_round.feedback)
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
