-- Where the caller's calories came from: each Food's total over a range (spec 011, Top foods).
--
-- As with daily_totals, calories are the Food's *current* ones (ADR 0001) summed exactly and rounded
-- once per Food, and Archived Foods are included, flagged, because their Entries still count.

create function public.food_totals(range_from date, range_to date)
returns table (
  food_id uuid,
  name text,
  portion text,
  archived boolean,
  calories integer,
  entry_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    f.id,
    f.name,
    f.portion,
    f.archived_at is not null,
    round(sum(e.quantity * f.calories))::integer,
    count(*)
  from public.entries e
  join public.foods f on f.id = e.food_id
  where e.day between range_from and range_to
  group by f.id, f.name, f.portion, f.archived_at
  order by 5 desc, f.name;
$$;

revoke execute on function public.food_totals(date, date) from public, anon;
grant execute on function public.food_totals(date, date) to authenticated;
