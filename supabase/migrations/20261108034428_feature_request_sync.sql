-- The Feature Request sync and what Users see of each other's requests (spec 124, Slice 2).
-- New functions only, so the deployed app is unaffected.

-- Records the stages the board's sync worked out from GitHub, keyed by Feature Issue. Requests the
-- app doesn't know, and withdrawn ones, are left alone. Returns every request it updated, marking
-- those whose stage just changed into Ready to try or Not going ahead, so each is notified once even
-- if the same sync arrives twice. Only the server (service role) may call it.
create function public.apply_feature_request_sync(updates jsonb)
returns table (
  request_id uuid,
  requester_id uuid,
  goal_text text,
  new_stage text,
  comment text,
  notify boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  previous text;
  saved public.feature_requests;
begin
  for item in select value from jsonb_array_elements(updates) loop
    select r.stage into previous
    from public.feature_requests r
    where r.feature_issue = (item ->> 'featureIssue')::integer and r.withdrawn_at is null
    for update;
    if not found then
      continue;
    end if;

    update public.feature_requests r
    set stage = item ->> 'stage',
        spec_issue = (item ->> 'specIssue')::integer,
        latest_comment = left(item ->> 'latestComment', 200),
        ready_note = left(item ->> 'readyNote', 2000),
        stage_changed_at = case when r.stage = item ->> 'stage' then r.stage_changed_at else now() end
    where r.feature_issue = (item ->> 'featureIssue')::integer and r.withdrawn_at is null
    returning r.* into saved;

    request_id := saved.id;
    requester_id := saved.user_id;
    goal_text := saved.goal;
    new_stage := saved.stage;
    comment := saved.latest_comment;
    notify := saved.stage is distinct from previous
      and saved.stage in ('ready_to_try', 'not_going_ahead');
    return next;
  end loop;
end;
$$;

revoke all on function public.apply_feature_request_sync(jsonb) from public, anon, authenticated;
grant execute on function public.apply_feature_request_sync(jsonb) to service_role;

-- Other Users' requests that are in progress or ready to try, so nobody asks twice. Never says who
-- asked, nor their problem or details.
create function public.other_feature_requests()
returns table (id uuid, goal text, stage text, feature_issue integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.goal, r.stage, r.feature_issue, r.created_at
  from public.feature_requests r
  where r.user_id <> (select auth.uid())
    and r.withdrawn_at is null
    and r.feature_issue is not null
    and r.stage in ('submitted', 'being_reviewed', 'planning', 'building', 'waiting_for_owner', 'ready_to_try')
  order by r.created_at desc;
$$;

revoke all on function public.other_feature_requests() from public, anon;
grant execute on function public.other_feature_requests() to authenticated;

-- How many requests, anyone's, are waiting to be triaged ahead of one of the caller's own. A guide:
-- the Dispatcher also works on the owner's Issues. Null for a request that isn't the caller's.
create function public.feature_requests_ahead(request_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*)::integer
    from public.feature_requests r
    where r.withdrawn_at is null
      and r.stage in ('submitted', 'being_reviewed')
      and r.created_at < mine.created_at
  )
  from public.feature_requests mine
  where mine.id = feature_requests_ahead.request_id
    and mine.user_id = (select auth.uid());
$$;

revoke all on function public.feature_requests_ahead(uuid) from public, anon;
grant execute on function public.feature_requests_ahead(uuid) to authenticated;
