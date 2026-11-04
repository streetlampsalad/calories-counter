-- Calories Burned (spec 017): what a User's watch says they burned on a Day, optional, entered by
-- hand for now. The Deficit is Calories Burned minus the Daily Total and is never stored (ADR 0001),
-- so only the burned figure and the User's switch live here.
--
-- Only adds a column and a table, so the app version already deployed carries on working.

alter table public.user_settings
  add column track_calories_burned boolean not null default false;

create table public.calories_burned (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  -- Whole kcal, resting plus activity, so never tiny.
  calories integer not null check (calories between 500 and 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create trigger calories_burned_set_updated_at
  before update on public.calories_burned
  for each row execute function public.set_updated_at();

alter table public.calories_burned enable row level security;

revoke all on public.calories_burned from anon;

create policy "Users read their own calories burned"
  on public.calories_burned for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add their own calories burned"
  on public.calories_burned for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users change their own calories burned"
  on public.calories_burned for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete their own calories burned"
  on public.calories_burned for delete to authenticated
  using (user_id = (select auth.uid()));

-- Everything the Summary needs about each Day in a range, in one round trip: the Daily Total (from
-- Entries and the Foods' current Calories, as daily_totals computes it) and Calories Burned. A Day
-- appears if it has either. `calories` is null on a Day with only Calories Burned, and
-- `calories_burned` is null on a Day with only Entries, so "not logged" is never "zero".
create function public.period_days(range_from date, range_to date)
returns table (day date, calories integer, entry_count bigint, calories_burned integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with eaten as (
    select e.day, round(sum(e.quantity * f.calories))::integer as calories, count(*) as entry_count
    from public.entries e
    join public.foods f on f.id = e.food_id
    where e.day between range_from and range_to
    group by e.day
  ),
  burned as (
    select b.day, b.calories
    from public.calories_burned b
    where b.day between range_from and range_to
  )
  select
    coalesce(eaten.day, burned.day),
    eaten.calories,
    coalesce(eaten.entry_count, 0),
    burned.calories
  from eaten
  full outer join burned on burned.day = eaten.day
  order by 1;
$$;

revoke execute on function public.period_days(date, date) from public, anon;
grant execute on function public.period_days(date, date) to authenticated;
