-- How many Entries each of the caller's Foods has, for the "changing this updates N past
-- Entries" warning (spec 003 AC-4). Entries do not exist yet, so every count is zero until
-- spec 008 replaces this function with the real one.

create function public.food_entry_counts()
returns table (food_id uuid, entry_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.id, 0::bigint from public.foods f;
$$;

revoke execute on function public.food_entry_counts() from public, anon;
grant execute on function public.food_entry_counts() to authenticated;
