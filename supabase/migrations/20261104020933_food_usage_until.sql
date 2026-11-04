-- Planned Entries (spec 013) sit on Days after today. The picker's Recent row and its ordering are
-- about what was eaten, so this version stops at `until` (the device's today).
--
-- The one-argument food_usage(since) stays: the app that is deployed while this migration lands
-- still calls it (ADR 0003). A later migration can drop it.

create function public.food_usage(since date, until date)
returns table (food_id uuid, entry_count bigint, last_logged_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.food_id, count(*), max(e.created_at)
  from public.entries e
  where e.day >= since and e.day <= until
  group by e.food_id;
$$;

revoke execute on function public.food_usage(date, date) from public, anon;
grant execute on function public.food_usage(date, date) to authenticated;
