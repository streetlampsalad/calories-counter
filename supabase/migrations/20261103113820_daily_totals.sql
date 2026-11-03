-- The caller's total calories for each logged Day in a range (spec 010), in one round trip.
--
-- Totals are never stored: each is Quantity times the Food's *current* calories, summed exactly and
-- rounded once, so a Food edit corrects every past Day at once (ADR 0001) and Archived Foods still
-- count. Days with no Entries are simply absent, which is how "not logged" differs from zero.

create function public.daily_totals(range_from date, range_to date)
returns table (day date, calories integer, entry_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.day, round(sum(e.quantity * f.calories))::integer, count(*)
  from public.entries e
  join public.foods f on f.id = e.food_id
  where e.day between range_from and range_to
  group by e.day
  order by e.day;
$$;

revoke execute on function public.daily_totals(date, date) from public, anon;
grant execute on function public.daily_totals(date, date) to authenticated;
