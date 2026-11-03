-- Entries: a User ate some Portions of one Food on one Day (spec 008, ADR 0001).
--
-- An Entry stores only the Food and a Quantity, never a copy of the calories, so a Food edit
-- corrects history. Foods that Entries refer to can therefore never be deleted (on delete restrict).

create table public.entries (
  -- Made on the device so an optimistic row keeps its identity once saved.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  -- A calendar date as the User experienced it: no time zone, no conversion.
  day date not null,
  -- Half-portion steps, up to 20 (spec 008).
  quantity numeric(4, 1) not null
    check (quantity > 0 and quantity <= 20 and quantity * 2 = floor(quantity * 2)),
  created_at timestamptz not null default now()
);

create index entries_user_day_idx on public.entries (user_id, day);
create index entries_food_idx on public.entries (food_id);

alter table public.entries enable row level security;

revoke all on public.entries from anon;

create policy "Users read their own entries"
  on public.entries for select to authenticated
  using (user_id = (select auth.uid()));

-- An Entry can only point at a Food its own User owns.
create policy "Users add entries for their own foods"
  on public.entries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id = (select auth.uid())
    )
  );

create policy "Users change their own entries"
  on public.entries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id = (select auth.uid())
    )
  );

create policy "Users delete their own entries"
  on public.entries for delete to authenticated
  using (user_id = (select auth.uid()));

-- Replaces the placeholder from spec 003: the real number of Entries per Food.
create or replace function public.food_entry_counts()
returns table (food_id uuid, entry_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.id, count(e.id)
  from public.foods f
  left join public.entries e on e.food_id = f.id
  group by f.id;
$$;
