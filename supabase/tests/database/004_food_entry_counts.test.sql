-- food_entry_counts reports one row per Food the caller owns, and nothing for anyone else.
begin;
select plan(4);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (user_id, name, portion, calories)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rice', '100 g', 130),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pasta', '100 g', 160);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.food_entry_counts()),
  2::bigint,
  'one row per Food the caller owns'
);
select is(
  (select count(*) from public.food_entry_counts() where entry_count = 0),
  2::bigint,
  'with no Entries yet, every count is zero'
);
select is(
  (select count(*) from public.food_entry_counts() c
     join public.foods f on f.id = c.food_id where f.name = 'Pasta'),
  0::bigint,
  'another User''s Foods are not reported'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.food_entry_counts() $$,
  '42501', null, 'anon cannot call it'
);
reset role;

select * from finish();
rollback;
