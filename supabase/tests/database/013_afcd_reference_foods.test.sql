-- The real AFCD Reference Foods loaded by the data migration (spec 007 AC-2): complete, consistent,
-- and fast to search. Runs against whatever the migrations loaded, so it reads, never deletes.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select cmp_ok(
  (select count(*) from public.reference_foods where source = 'AFCD'),
  '>=', 1500::bigint,
  'the whole AFCD release is loaded'
);
select cmp_ok(
  (select count(*) from public.reference_foods where source = 'AFCD' and unit = 'ml'),
  '>=', 150::bigint,
  'liquids are loaded per 100 mL'
);
select is(
  (select count(*) from public.reference_foods
    where source = 'AFCD'
      and calories_per_100 <> round(energy_kj_per_100 / 4.184)),
  0::bigint,
  'every Calories value is its kilojoules converted at 4.184 kJ per kcal'
);
select is(
  (select count(*) from public.reference_foods
    where source = 'AFCD' and source_id !~ '^F[0-9]{6}$'),
  0::bigint,
  'every AFCD food is keyed by its Public Food Key'
);
select ok(
  (select bool_or(name ilike 'Banana, cavendish%') from public.search_reference_foods('banana', 50)),
  'a search for banana finds the cavendish banana'
);
select ok(
  (select bool_or(name ilike 'Banana%') from public.search_reference_foods('bananna', 50)),
  'a typo (bananna) still finds bananas'
);
select is(
  (select name ilike 'Milk%' from public.search_reference_foods('milk') limit 1),
  true,
  'foods that start with the query come first'
);

-- AC-2: results within 300 ms on the server.
create temp table timing (took interval);
grant all on timing to authenticated;
do $$
declare started timestamptz := clock_timestamp();
begin
  perform * from public.search_reference_foods('chicken breast');
  insert into timing values (clock_timestamp() - started);
end $$;
select ok(
  (select took from timing) < interval '300 milliseconds',
  'a search takes under 300 ms'
);

select * from finish();
rollback;
