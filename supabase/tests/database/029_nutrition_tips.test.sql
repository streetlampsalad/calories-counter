-- Nutrition tips (spec 219, Slice 2): one kept set per User per week, private to its User, with 1 to 3 tips.
begin;
select plan(21);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.test');

select is(
  (select relrowsecurity from pg_class where oid = 'public.nutrition_tips'::regclass),
  true, 'FR-007: nutrition_tips has RLS enabled'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'nutrition_tips'),
  4::bigint, 'and four policies'
);
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'nutrition_tips' and roles = '{authenticated}'),
  4::bigint, 'each to authenticated only'
);
select col_type_is('public', 'nutrition_tips', 'week_start', 'date', 'US2.5: week_start is a date');

-- Another User's set, written as the table owner.
insert into public.nutrition_tips (user_id, week_start, tips)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-11-02', '[{"nutrient":"Iron","tip":"Add lentils."}]');

-- Checks and the primary key (as the table owner, so RLS does not get in the way).
select throws_ok(
  $$ insert into public.nutrition_tips (user_id, week_start, tips)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-02', '[]') $$,
  '23514', null, 'US2.5: no tips is rejected'
);
select throws_ok(
  $$ insert into public.nutrition_tips (user_id, week_start, tips)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-02',
       '[{"nutrient":"a","tip":"a"},{"nutrient":"b","tip":"b"},{"nutrient":"c","tip":"c"},{"nutrient":"d","tip":"d"}]') $$,
  '23514', null, 'US2.5: four tips are rejected'
);
select throws_ok(
  $$ insert into public.nutrition_tips (user_id, week_start, tips)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-02', '{"nutrient":"a","tip":"a"}') $$,
  '23514', null, 'US2.5: an object is rejected as a check violation, not an error'
);
select throws_ok(
  $$ insert into public.nutrition_tips (user_id, week_start, tips)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-02', '"text"') $$,
  '23514', null, 'US2.5: a string is rejected'
);
select throws_ok(
  $$ insert into public.nutrition_tips (user_id, week_start, tips)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-02', 'null'::jsonb) $$,
  '23514', null, 'US2.5: a JSON null is rejected'
);
select lives_ok(
  $$ insert into public.nutrition_tips (user_id, week_start, tips)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-02',
       '[{"nutrient":"a","tip":"a"},{"nutrient":"b","tip":"b"},{"nutrient":"c","tip":"c"}]') $$,
  'US2.5: three tips are accepted'
);
select throws_ok(
  $$ insert into public.nutrition_tips (user_id, week_start, tips)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-02', '[{"nutrient":"a","tip":"a"}]') $$,
  '23505', null, 'US2.5: a second set for the same User and week is rejected'
);

-- The owner.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.nutrition_tips), 1::bigint, 'US2.4: a User reads only their own set');
select lives_ok(
  $$ insert into public.nutrition_tips (week_start, tips)
     values ('2026-11-09', '[{"nutrient":"Fibre","tip":"Add oats."}]') $$,
  'a User adds a set, user_id defaulting to themselves'
);
select lives_ok(
  $$ update public.nutrition_tips set tips = '[{"nutrient":"Iron","tip":"Add beans."}]' where week_start = '2026-11-09' $$,
  'a User replaces their own set'
);
select is(
  (select tips->0->>'tip' from public.nutrition_tips where week_start = '2026-11-09'),
  'Add beans.', 'and the replacement is kept'
);
select throws_ok(
  $$ insert into public.nutrition_tips (user_id, week_start, tips)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-11-09', '[{"nutrient":"a","tip":"a"}]') $$,
  '42501', null, 'US2.4: a User cannot add a set for another User'
);
select throws_ok(
  $$ update public.nutrition_tips set user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where week_start = '2026-11-09' $$,
  '42501', null, 'US2.4: nor hand their own set to another User'
);
update public.nutrition_tips set tips = '[{"nutrient":"x","tip":"x"}]' where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
delete from public.nutrition_tips where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select lives_ok($$ delete from public.nutrition_tips where week_start = '2026-11-09' $$, 'a User removes their own set');

-- The other User still has theirs, unchanged.
reset role;
select is(
  (select tips->0->>'nutrient' from public.nutrition_tips where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'Iron', 'US2.4: another User cannot change or remove it'
);

-- Signed out sees nothing.
set local role anon;
select throws_ok($$ select * from public.nutrition_tips $$, '42501', null, 'signed out cannot read Nutrition tips');
reset role;

-- The other User sees only theirs.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.nutrition_tips), 1::bigint, 'US2.4: the other User reads only their own');

select * from finish();
rollback;
