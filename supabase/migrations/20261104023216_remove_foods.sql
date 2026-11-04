-- Removing and restoring many Foods in one request (spec 014).
--
-- remove_foods follows ADR 0001 for each Food: one that Entries refer to is Archived, one with no
-- Entries is deleted for good. The choice is made here, when the request runs, not by the app, so a
-- Food that gained an Entry since the User last looked is Archived instead of failing on the foreign
-- key. Both functions are security invoker, so row-level security still limits them to the caller's
-- own Foods.

create function public.remove_foods(ids uuid[])
returns table (food_id uuid, outcome text)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  -- Lock the Foods first. Logging an Entry against one has to wait until we are finished, so
  -- "has Entries" cannot change between the check and the removal.
  perform 1 from public.foods f where f.id = any(ids) for update;

  return query
  with archived as (
    update public.foods f
    set archived_at = now()
    where f.id = any(ids)
      and exists (select 1 from public.entries e where e.food_id = f.id)
    returning f.id
  ), deleted as (
    delete from public.foods f
    where f.id = any(ids)
      and not exists (select 1 from public.entries e where e.food_id = f.id)
    returning f.id
  )
  select a.id, 'archived'::text from archived a
  union all
  select d.id, 'deleted'::text from deleted d;
end;
$$;

-- Brings Archived Foods back, all or none: if one now clashes with a live Food's name and Portion
-- (spec 003 AC-9) the whole call fails and nothing is restored.
create function public.restore_foods(ids uuid[])
returns table (food_id uuid)
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.foods f
  set archived_at = null
  where f.id = any(ids) and f.archived_at is not null
  returning f.id;
$$;

revoke execute on function public.remove_foods(uuid[]) from public, anon;
grant execute on function public.remove_foods(uuid[]) to authenticated;
revoke execute on function public.restore_foods(uuid[]) from public, anon;
grant execute on function public.restore_foods(uuid[]) to authenticated;
