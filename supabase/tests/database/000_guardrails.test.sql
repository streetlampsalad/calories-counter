-- Schema-wide guardrails that every migration must keep passing.
begin;
select plan(2);

-- Every table in public must have row level security enabled, so no User
-- can ever read another User's data through the API.
select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every public table has row level security enabled'
);

-- RLS without policies silently denies everything; tables must say who can see what.
select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
      )
  $$,
  'every public table has at least one policy'
);

select * from finish();
rollback;
