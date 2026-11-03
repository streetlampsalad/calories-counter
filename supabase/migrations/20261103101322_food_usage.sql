-- How often and how recently each of the caller's Foods was logged, for ordering the picker
-- (spec 008): most-logged first, plus a "Recent" row. Only Entries on or after `since` count.

create function public.food_usage(since date)
returns table (food_id uuid, entry_count bigint, last_logged_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.food_id, count(*), max(e.created_at)
  from public.entries e
  where e.day >= since
  group by e.food_id;
$$;

revoke execute on function public.food_usage(date) from public, anon;
grant execute on function public.food_usage(date) to authenticated;
