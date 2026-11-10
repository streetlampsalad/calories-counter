-- Bug reports (spec 194): what a User tells the Owner is broken, sent from inside the app. The
-- server creates each one's Bug Issue on GitHub, so Users only read. The User's words, Toggles
-- and device live only in the public Issue, never here. Everything sits behind Toggle feature-192
-- (ADR 0008). Additive only.

insert into public.toggles (key, title) values ('feature-192', 'Report a bug') on conflict do nothing;

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Null only between the row being added and its Issue being created.
  bug_issue integer unique,
  created_at timestamptz not null default now()
);

create index bug_reports_user_id_created_at_idx on public.bug_reports (user_id, created_at);

-- At most 5 Bug reports per User in any 24 hours. The lock makes two sends at once queue, so both
-- cannot count 4 and pass.
create function public.bug_reports_daily_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('bug_reports:' || new.user_id::text));
  if (
    select count(*) from public.bug_reports r
    where r.user_id = new.user_id
      and r.created_at > now() - interval '24 hours'
  ) >= 5
  then
    raise exception 'bug_report_limit' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger bug_reports_daily_limit
  before insert on public.bug_reports
  for each row execute function public.bug_reports_daily_limit();

revoke all on function public.bug_reports_daily_limit() from public, anon, authenticated;

alter table public.bug_reports enable row level security;

revoke all on public.bug_reports from anon, authenticated;
grant select on public.bug_reports to authenticated;

create policy "Users read their own Bug reports"
  on public.bug_reports for select to authenticated
  using (user_id = (select auth.uid()));
