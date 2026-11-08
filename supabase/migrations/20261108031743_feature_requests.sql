-- Feature Requests (spec 124): what a User asks the app to do next. The server creates each one's
-- Feature Issue on GitHub and later records the stage the agents have reached, so Users only read.
-- Everything sits behind Toggle feature-114 (ADR 0008). Additive only.

insert into public.toggles (key, title) values ('feature-114', 'Feature requests');

create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal text not null check (char_length(btrim(goal)) between 10 and 2000),
  problem text check (char_length(problem) <= 4000),
  details text check (char_length(details) <= 4000),
  -- Null only between the row being added and its Issue being created.
  feature_issue integer unique,
  spec_issue integer,
  -- Live for everyone and Removed are never stored: they come from the request's Toggle.
  stage text not null default 'submitted' check (
    stage in ('submitted', 'being_reviewed', 'planning', 'building', 'waiting_for_owner', 'ready_to_try', 'not_going_ahead')
  ),
  latest_comment text check (char_length(latest_comment) <= 200),
  ready_note text check (char_length(ready_note) <= 2000),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  stage_changed_at timestamptz not null default now()
);

create index feature_requests_user_id_idx on public.feature_requests (user_id);

-- At most 2 requests per User that agents are still working on. The lock makes two submits at
-- once queue, so both cannot see one open request and pass.
create function public.feature_requests_open_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('feature_requests:' || new.user_id::text));
  if new.withdrawn_at is null
    and new.stage in ('submitted', 'being_reviewed', 'planning', 'building', 'waiting_for_owner')
    and (
      select count(*) from public.feature_requests r
      where r.user_id = new.user_id
        and r.withdrawn_at is null
        and r.stage in ('submitted', 'being_reviewed', 'planning', 'building', 'waiting_for_owner')
    ) >= 2
  then
    raise exception 'feature_request_limit' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger feature_requests_open_limit
  before insert on public.feature_requests
  for each row execute function public.feature_requests_open_limit();

revoke all on function public.feature_requests_open_limit() from public, anon, authenticated;

alter table public.feature_requests enable row level security;

revoke all on public.feature_requests from anon, authenticated;
grant select on public.feature_requests to authenticated;

create policy "Requesters read their own Feature Requests"
  on public.feature_requests for select to authenticated
  using (user_id = (select auth.uid()));
