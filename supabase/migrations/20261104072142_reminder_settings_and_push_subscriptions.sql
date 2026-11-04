-- The daily Reminder (spec 016, ADR 0005): when a User wants it, the phones that can show it, and
-- the question the scheduler asks every 15 minutes: who is due right now?
--
-- Only adds columns and tables, so the app version already deployed carries on working.

alter table public.user_settings
  add column reminder_enabled boolean not null default false,
  -- On a 15-minute boundary, in the User's own clock (time_zone).
  add column reminder_time time not null default '19:00',
  -- The device's IANA name (e.g. Australia/Sydney) when the Reminder was last set. The only place
  -- the app stores a time zone: Days themselves stay plain dates.
  add column time_zone text,
  -- The User's local Day a Reminder was last sent for, so there is at most one per Day.
  add column reminder_last_sent_on date,
  add constraint user_settings_reminder_time_on_quarter_hour
    check (
      extract(minute from reminder_time)::integer % 15 = 0
      and extract(second from reminder_time) = 0
    ),
  add constraint user_settings_reminder_needs_time_zone
    check (not reminder_enabled or time_zone is not null);

-- A check cannot look the zone up, so a trigger refuses names Postgres does not know.
create function public.check_user_settings_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.time_zone is not null then
    perform now() at time zone new.time_zone;
  end if;
  return new;
end;
$$;

create trigger user_settings_check_time_zone
  before insert or update of time_zone on public.user_settings
  for each row execute function public.check_user_settings_time_zone();

-- One row per device that can show the User's Reminder.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 1 and 2000),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon;

create policy "Users read their own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add their own push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users change their own push subscriptions"
  on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete their own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Everyone whose Reminder is due at a moment, with the devices to send it to.
--
-- Due means: the Reminder is on, `at` falls in the 15-minute slot that starts at the User's chosen
-- time on their own clock, nothing has been sent for that local Day, and that Day has no Entries.
-- A Planned Entry for today is an Entry like any other (ADR 0004). The slot is compared as a
-- number so a 23:45 Reminder works across midnight, and the zone is applied per User so daylight
-- saving needs no special case.
--
-- Security definer because it reads every User's rows; only the scheduler's route may call it.
create function public.due_reminders(at timestamptz)
returns table (
  user_id uuid,
  local_day date,
  subscription_id uuid,
  endpoint text,
  p256dh_key text,
  auth_secret text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.user_id,
    (at at time zone s.time_zone)::date,
    p.id,
    p.endpoint,
    p.p256dh,
    p.auth
  from public.user_settings s
  join public.push_subscriptions p on p.user_id = s.user_id
  where s.reminder_enabled
    and s.time_zone is not null
    and floor(extract(epoch from (at at time zone s.time_zone)::time) / 900)
      = extract(epoch from s.reminder_time) / 900
    and s.reminder_last_sent_on is distinct from (at at time zone s.time_zone)::date
    and not exists (
      select 1
      from public.entries e
      where e.user_id = s.user_id
        and e.day = (at at time zone s.time_zone)::date
    )
  order by s.user_id, p.created_at;
$$;

revoke all on function public.due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz) to service_role;
