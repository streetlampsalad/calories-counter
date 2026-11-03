-- How much of a metered service (the photo reader, spec 006) each User has used today.
--
-- A User may read their own counts but never write them: only increment_ai_usage can, and it
-- refuses once the limit is reached, so a User cannot reset or skip their own limit.

create table public.ai_usage (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (char_length(kind) between 1 and 40),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

alter table public.ai_usage enable row level security;

revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

create policy "Users read their own usage"
  on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Counts one use for the caller today, and says whether it was allowed. A Day is a calendar day in
-- Sydney. A refused use is not counted. Security definer so it can write the table the caller cannot.
create function public.increment_ai_usage(usage_kind text, max_per_day integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  today date := (now() at time zone 'Australia/Sydney')::date;
  used integer;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if max_per_day < 1 then
    return false;
  end if;

  insert into public.ai_usage as u (user_id, day, kind, count)
  values (caller, today, usage_kind, 1)
  on conflict (user_id, day, kind)
  do update set count = u.count + 1 where u.count < max_per_day
  returning u.count into used;

  return used is not null;
end;
$$;

revoke all on function public.increment_ai_usage(text, integer) from public, anon;
grant execute on function public.increment_ai_usage(text, integer) to authenticated;
