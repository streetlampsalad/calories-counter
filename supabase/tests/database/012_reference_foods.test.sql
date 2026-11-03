-- reference_foods: a shared, read-only table of Australian foods, searched by name (spec 007).
begin;
select plan(14);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test');

-- This transaction's own foods, whatever the local seed has loaded.
delete from public.reference_foods;
insert into public.reference_foods (source, source_id, name, energy_kj_per_100, calories_per_100, unit)
values
  ('TEST', '1', 'Banana, cavendish, raw', 389, 93, 'g'),
  ('TEST', '2', 'Bananas, dried', 1100, 263, 'g'),
  ('TEST', '3', 'Plantain, banana type, cooked', 500, 120, 'g'),
  ('TEST', '4', 'Apple, red, raw', 220, 53, 'g'),
  ('TEST', '5', 'Milk, cow, full fat', 270, 65, 'ml'),
  ('TEST', '6', 'Beef, mince, 100% pure', 900, 215, 'g'),
  ('TEST', '7', '50% off the 100%_pure test', 0, 0, 'g');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select array_agg(name) from public.search_reference_foods('banana')),
  array['Banana, cavendish, raw', 'Bananas, dried', 'Plantain, banana type, cooked'],
  'finds foods by name, those that start with the query first'
);
select is(
  (select name from public.search_reference_foods('BANANA') limit 1),
  'Banana, cavendish, raw',
  'ignores case'
);
select is(
  (select name from public.search_reference_foods('bananna') limit 1),
  'Banana, cavendish, raw',
  'tolerates a typo'
);
select is(
  (select name from public.search_reference_foods('aple') limit 1),
  'Apple, red, raw',
  'tolerates a missing letter'
);
select is(
  (select count(*) from public.search_reference_foods('zzzz')),
  0::bigint,
  'finds nothing for nonsense'
);
select is(
  (select name from public.search_reference_foods('milk') limit 1),
  'Milk, cow, full fat',
  'finds a food by its first word'
);
select is(
  (select name from public.search_reference_foods('mince') limit 1),
  'Beef, mince, 100% pure',
  'finds a food by a word later in its name'
);
select is(
  (select count(*) from public.search_reference_foods('100%')),
  2::bigint,
  'treats % in the query as an ordinary character'
);
select is(
  (select count(*) from public.search_reference_foods('b', 2)),
  2::bigint,
  'returns at most the number asked for'
);
select is(
  (select count(*) from public.search_reference_foods('')),
  0::bigint,
  'an empty query finds nothing'
);
select is(
  (select unit from public.search_reference_foods('milk') limit 1),
  'ml',
  'says whether the energy is per 100 g or per 100 ml'
);

-- Shared and read-only.
select throws_ok(
  $$ insert into public.reference_foods (source, source_id, name, energy_kj_per_100, calories_per_100, unit)
     values ('X', '1', 'Mine', 1, 1, 'g') $$,
  '42501', null, 'a User cannot add a reference food'
);
select throws_ok(
  $$ delete from public.reference_foods $$,
  '42501', null, 'or delete one'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.search_reference_foods('banana') $$,
  '42501', null, 'anon cannot search'
);
reset role;

select * from finish();
rollback;
