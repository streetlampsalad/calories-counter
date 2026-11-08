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
  set state = case decide_feature_request.decision when 'ready' then 'live' else 'removed' end
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
