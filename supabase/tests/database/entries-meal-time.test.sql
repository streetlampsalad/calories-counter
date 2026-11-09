-- Meal time on an Entry (spec 174): one of four values or none, and private like the Entry.
begin;
select plan(6);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories)
values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.entries (food_id, day, quantity, meal_time)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1, 'breakfast') $$,
  'an Entry can have a Meal time'
);
select lives_ok(
  $$ insert into public.entries (food_id, day, quantity)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1) $$,
  'an Entry can have no Meal time'
);
select throws_ok(
  $$ insert into public.entries (food_id, day, quantity, meal_time)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1, 'brunch') $$,
  '23514', null, 'any other value is rejected'
);
select throws_ok(
  $$ update public.entries set meal_time = 'supper' $$,
  '23514', null, 'an update to another value is rejected'
);
select is(
  (select count(*) from public.entries where meal_time is null), 1::bigint,
  'the Entry without a Meal time reads back with none'
);

-- Another User sees none of it.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*) from public.entries), 0::bigint,
  'another User cannot read these Entries or their Meal times');

select * from finish();
rollback;
