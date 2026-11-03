-- user_settings: private to their User, bounded, with sensible defaults.
begin;
select plan(15);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

-- A User with no row reads nothing: the app supplies the defaults.
select is((select count(*) from public.user_settings), 0::bigint, 'no row until settings are saved');

insert into public.user_settings (daily_goal_calories) values (2200);

select is(
  (select user_id from public.user_settings),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'a new row belongs to the signed-in User by default'
);
select is(
  (select week_starts_on from public.user_settings),
  1::smallint,
  'weeks start on Monday unless changed'
);

-- Bounds.
select lives_ok($$ update public.user_settings set daily_goal_calories = 500 $$, 'a Goal of 500 is allowed');
select lives_ok($$ update public.user_settings set daily_goal_calories = 10000 $$, 'a Goal of 10,000 is allowed');
select throws_ok($$ update public.user_settings set daily_goal_calories = 499 $$, '23514', null, 'a Goal below 500 is refused');
select throws_ok($$ update public.user_settings set daily_goal_calories = 10001 $$, '23514', null, 'a Goal above 10,000 is refused');
select lives_ok($$ update public.user_settings set daily_goal_calories = null $$, 'a Goal can be cleared');
select lives_ok($$ update public.user_settings set week_starts_on = 0 $$, 'weeks can start on Sunday');
select throws_ok($$ update public.user_settings set week_starts_on = 2 $$, '23514', null, 'only Monday or Sunday');

-- One row per User.
select throws_ok(
  $$ insert into public.user_settings (daily_goal_calories) values (1800) $$,
  '23505', null, 'a User has at most one settings row'
);

-- Another User sees and changes nothing, and cannot write for someone else.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is((select count(*) from public.user_settings), 0::bigint, 'another User sees no settings');

update public.user_settings set week_starts_on = 1;
delete from public.user_settings;

select throws_ok(
  $$ insert into public.user_settings (user_id, daily_goal_calories)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 900) $$,
  '42501', null, 'a User cannot write settings for someone else'
);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is(
  (select week_starts_on from public.user_settings),
  0::smallint,
  'another User could not change or delete the row'
);

reset role;
set local role anon;
select throws_ok($$ select * from public.user_settings $$, '42501', null, 'anon cannot read settings');
reset role;

select * from finish();
rollback;
