-- Rounds (spec 135, Slice 1): a Requester's feedback on a request that is Ready to try becomes a
-- follow-up Feature Issue behind the same Toggle, and the request follows its newest Round. For a
-- request with no Rounds every function answers as before, so the deployed app is unaffected.

create table public.feature_request_rounds (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feature_requests (id) on delete cascade,
  feedback text not null check (char_length(btrim(feedback)) between 10 and 4000),
  -- Null only between the row being added and its Issue being created.
  feature_issue integer unique,
  created_at timestamptz not null default now()
);

create index feature_request_rounds_request_id_idx on public.feature_request_rounds (request_id, created_at);

alter table public.feature_request_rounds enable row level security;

revoke all on public.feature_request_rounds from anon, authenticated;
grant select on public.feature_request_rounds to authenticated;

create policy "Requesters read the Rounds of their own Feature Requests"
  on public.feature_request_rounds for select to authenticated
  using (exists (
    select 1 from public.feature_requests r
    where r.id = request_id and r.user_id = (select auth.uid())
  ));

-- When the request was first Ready to try. From then on its Requester keeps their switch (D3) and
-- can no longer withdraw it (D12).
alter table public.feature_requests add column first_ready_at timestamptz;

update public.feature_requests
set first_ready_at = stage_changed_at
where stage = 'ready_to_try';

create function public.feature_requests_first_ready()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage = 'ready_to_try' and new.first_ready_at is null then
    new.first_ready_at := now();
  end if;
  return new;
end;
$$;

create trigger feature_requests_first_ready
  before insert or update of stage on public.feature_requests
  for each row execute function public.feature_requests_first_ready();

revoke all on function public.feature_requests_first_ready() from public, anon, authenticated;

-- Starts a Round on the Requester's own request: only once it has been Ready to try and is Ready to
-- try again (or its last Round was declined, D13), with its Toggle still in Testing. The request goes
-- back to Submitted in the same transaction as the open-request check, under the same lock as new
-- requests, so feedback counts towards the 2 at a time. Returns no Round when it may not start one,
-- and otherwise what the request was, so undo_feature_request_round can put it back.
-- Only the server (service role) may call it, after checking the caller.
create function public.start_feature_request_round(request_id uuid, requester_id uuid, feedback text)
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

revoke all on function public.start_feature_request_round(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_feature_request_round(uuid, uuid, text) to service_role;

-- Undoes a Round whose follow-up Feature Issue could not be created or recorded: puts the request
-- back as it was and deletes the Round, together, so a sync never finds the request at Submitted
-- with no Round (and notifies a Ready to try it already had). Only the server may call it.
create function public.undo_feature_request_round(
  round_id uuid,
  stage text,
  stage_changed_at timestamptz,
  latest_comment text default null,
  ready_note text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  with round as (
    delete from public.feature_request_rounds x
    where x.id = undo_feature_request_round.round_id
    returning x.request_id
  )
  update public.feature_requests r
  set stage = undo_feature_request_round.stage,
      stage_changed_at = undo_feature_request_round.stage_changed_at,
      latest_comment = undo_feature_request_round.latest_comment,
      ready_note = undo_feature_request_round.ready_note
  from round
  where r.id = round.request_id;
$$;

revoke all on function public.undo_feature_request_round(uuid, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.undo_feature_request_round(uuid, text, timestamptz, text, text) to service_role;

-- As before, but a request is found by its own Feature Issue or one of its Rounds', and an update
-- counts only when it is about the request's newest Issue: its newest Round's (nothing while that
-- Round's Issue is still being created), else its own. A Round's Spec Issue is not recorded, so the
-- request keeps its own.
create or replace function public.apply_feature_request_sync(updates jsonb)
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
  issue integer;
  found_id uuid;
  newest integer;
  previous text;
  saved public.feature_requests;
begin
  for item in select value from jsonb_array_elements(updates) loop
    issue := (item ->> 'featureIssue')::integer;

    select r.id, r.stage into found_id, previous
    from public.feature_requests r
    where r.withdrawn_at is null
      and (r.feature_issue = issue or exists (
        select 1 from public.feature_request_rounds x where x.request_id = r.id and x.feature_issue = issue
      ))
    for update;
    if not found then
      continue;
    end if;

    select x.feature_issue into newest
    from public.feature_request_rounds x
    where x.request_id = found_id
    order by x.created_at desc, x.id desc
    limit 1;
    if not found then
      select r.feature_issue into newest from public.feature_requests r where r.id = found_id;
    end if;
    if newest is distinct from issue then
      continue;
    end if;

    update public.feature_requests r
    set stage = item ->> 'stage',
        spec_issue = case when r.feature_issue = issue then (item ->> 'specIssue')::integer else r.spec_issue end,
        latest_comment = left(item ->> 'latestComment', 200),
        ready_note = left(item ->> 'readyNote', 2000),
        stage_changed_at = case when r.stage = item ->> 'stage' then r.stage_changed_at else now() end
    where r.id = found_id
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

-- As before, but from the request's first Ready to try (D3), so the Requester keeps their switch
-- while a Round is built.
create or replace function public.can_try_toggle(key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_owner() or exists (
    select 1 from public.feature_requests r
    where 'feature-' || r.feature_issue = can_try_toggle.key
      and r.user_id = (select auth.uid())
      and r.first_ready_at is not null
      and r.withdrawn_at is null
  );
$$;
