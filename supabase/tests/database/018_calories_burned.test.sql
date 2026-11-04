-- calories_burned and period_days (spec 017): private to their User, bounded, one value per Day,
-- and a Summary query that shows eaten and burned together without confusing "none" with zero.
begin;
select plan(21);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories)
values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110),
  ('f2f2f2f2-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pasta', '100 g', 160);

insert into public.entries (user_id, food_id, day, quantity)
values
  -- Both eaten and burned
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-02', 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-02', 1.5),
  -- Eaten only
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1),
  -- Outside the range
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-10-30', 1),
  -- Another User's, on a day the first User also has
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f2f2f2f2-0000-0000-0000-000000000001', '2026-11-02', 4);

-- ---------------------------------------------------------------------------------------------
-- The setting.
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

insert into public.user_settings (daily_goal_calories) values (2200);
select is(
  (select track_calories_burned from public.user_settings),
  false,
  'tracking calories burned is off by default'
);
select lives_ok(
  $$ update public.user_settings set track_calories_burned = true $$,
  'a User can switch it on'
);

-- ---------------------------------------------------------------------------------------------
-- The table.
-- ---------------------------------------------------------------------------------------------
insert into public.calories_burned (day, calories) values ('2026-11-02', 2450);

select is(
  (select user_id from public.calories_burned),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'a new value belongs to the signed-in User by default'
);
select lives_ok(
  $$ insert into public.calories_burned (day, calories) values ('2026-11-04', 500) $$,
  '500 is allowed'
);
select lives_ok(
  $$ insert into public.calories_burned (day, calories) values ('2026-11-05', 10000) $$,
  '10,000 is allowed'
);
select throws_ok(
  $$ insert into public.calories_burned (day, calories) values ('2026-11-06', 499) $$,
  '23514', null, 'below 500 is refused'
);
select throws_ok(
  $$ insert into public.calories_burned (day, calories) values ('2026-11-06', 10001) $$,
  '23514', null, 'above 10,000 is refused'
);
select throws_ok(
  $$ insert into public.calories_burned (day, calories) values ('2026-11-02', 2600) $$,
  '23505', null, 'a Day has at most one value'
);
select lives_ok(
  $$ insert into public.calories_burned (day, calories) values ('2026-11-02', 2600)
     on conflict (user_id, day) do update set calories = excluded.calories $$,
  'saving a Day again replaces its value'
);
select is(
  (select calories from public.calories_burned where day = '2026-11-02'),
  2600,
  'and the new value is the one kept'
);
delete from public.calories_burned where day in ('2026-11-04', '2026-11-05');

-- ---------------------------------------------------------------------------------------------
-- period_days.
-- ---------------------------------------------------------------------------------------------
-- A Day with only Calories Burned.
insert into public.calories_burned (day, calories) values ('2026-11-04', 2300);

select is(
  (select count(*) from public.period_days('2026-11-01', '2026-11-05')),
  3::bigint,
  'every Day with Entries or Calories Burned appears, once'
);
select results_eq(
  $$ select day, calories, entry_count, calories_burned
     from public.period_days('2026-11-01', '2026-11-05') order by day $$,
  $$ values
       ('2026-11-02'::date, 385, 2::bigint, 2600),
       ('2026-11-03'::date, 110, 1::bigint, null::integer),
       ('2026-11-04'::date, null::integer, 0::bigint, 2300) $$,
  'eaten and burned side by side, with null for what is missing, never zero'
);
select is(
  (select count(*) from public.period_days('2026-11-03', '2026-11-03')),
  1::bigint,
  'a one-Day range returns just that Day'
);
select is(
  (select count(*) from public.period_days('2026-11-06', '2026-11-30')),
  0::bigint,
  'an empty range returns nothing'
);

-- ---------------------------------------------------------------------------------------------
-- Another User sees and changes nothing.
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is((select count(*) from public.calories_burned), 0::bigint, 'another User sees no values');
select results_eq(
  $$ select day, calories, calories_burned from public.period_days('2026-11-01', '2026-11-05') $$,
  $$ values ('2026-11-02'::date, 640, null::integer) $$,
  'period_days shows another User only their own Days'
);

update public.calories_burned set calories = 9999;
delete from public.calories_burned;
select throws_ok(
  $$ insert into public.calories_burned (user_id, day, calories)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-10', 2000) $$,
  '42501', null, 'a User cannot write a value for someone else'
);
insert into public.calories_burned (day, calories) values ('2026-11-02', 2100);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is(
  (select calories from public.calories_burned where day = '2026-11-02'),
  2600,
  'another User could not change or delete the value, and has their own for the same Day'
);
select is((select count(*) from public.calories_burned), 2::bigint, 'and the first User still has both of theirs');

reset role;
set local role anon;
select throws_ok($$ select * from public.calories_burned $$, '42501', null, 'anon cannot read values');
select throws_ok($$ select * from public.period_days('2026-11-01', '2026-11-05') $$, '42501', null, 'anon cannot call period_days');
reset role;

select * from finish();
rollback;
