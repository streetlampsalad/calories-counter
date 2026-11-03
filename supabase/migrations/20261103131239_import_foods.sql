-- Import Review's Save (spec 005): add and update many Foods in one transaction.
--
-- Each row is { name, portion, calories } to add, or { id, name, portion, calories } to update that
-- Food's calories (ADR 0001: its Entries follow, so history changes). It is one function call, so
-- any row that fails (a rule broken, a name and Portion already in the list, an id that is not the
-- caller's live Food) undoes the whole import.

create function public.import_foods(rows jsonb)
returns table (added integer, updated integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  n_added integer := 0;
  n_updated integer := 0;
begin
  if jsonb_typeof(rows) is distinct from 'array' then
    raise exception 'rows must be a list' using errcode = '22023';
  end if;
  if jsonb_array_length(rows) > 200 then
    raise exception 'at most 200 rows can be imported at once' using errcode = '54000';
  end if;

  for item in select * from jsonb_array_elements(rows) loop
    if item ->> 'id' is null then
      insert into public.foods (name, portion, calories)
      values (item ->> 'name', item ->> 'portion', (item ->> 'calories')::integer);
      n_added := n_added + 1;
    else
      update public.foods
         set calories = (item ->> 'calories')::integer
       where id = (item ->> 'id')::uuid
         and archived_at is null;
      if not found then
        raise exception 'that food is not in your list' using errcode = 'P0002';
      end if;
      n_updated := n_updated + 1;
    end if;
  end loop;

  return query select n_added, n_updated;
end;
$$;

revoke all on function public.import_foods(jsonb) from public, anon;
grant execute on function public.import_foods(jsonb) to authenticated;
