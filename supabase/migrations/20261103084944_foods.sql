-- Each User's Food List (spec 003, ADR 0001).
-- A Food that Entries refer to is Archived, never deleted, so history stays true.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  portion text not null check (char_length(btrim(portion)) between 1 and 40),
  calories integer not null check (calories between 0 and 9999),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live Food per name and Portion, ignoring case and surrounding spaces.
-- Archived Foods are exempt, so a name can be reused after archiving.
create unique index foods_unique_live_name_portion
  on public.foods (user_id, lower(btrim(name)), lower(btrim(portion)))
  where archived_at is null;

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

alter table public.foods enable row level security;

revoke all on public.foods from anon;

create policy "Users read their own foods"
  on public.foods for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add their own foods"
  on public.foods for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users change their own foods"
  on public.foods for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete their own foods"
  on public.foods for delete to authenticated
  using (user_id = (select auth.uid()));
