-- One settings row per User (spec 009): an optional daily Goal and the first day of the week.
-- A User with no row simply has the defaults, so nothing needs creating at sign-up.

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Whole kcal per Day, or null for "no Goal".
  daily_goal_calories integer check (daily_goal_calories between 500 and 10000),
  -- 1 = Monday, 0 = Sunday.
  week_starts_on smallint not null default 1 check (week_starts_on in (0, 1)),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

revoke all on public.user_settings from anon;

create policy "Users read their own settings"
  on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add their own settings"
  on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users change their own settings"
  on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete their own settings"
  on public.user_settings for delete to authenticated
  using (user_id = (select auth.uid()));
