-- Foods: private to their User, with sane bounds and one live Food per name and Portion.
begin;
select plan(16);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

-- Act as the first User.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

insert into public.foods (name, portion, calories) values ('Sourdough toast', '1 slice', 110);

select is(
  (select user_id from public.foods where name = 'Sourdough toast'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'a new Food belongs to the signed-in User by default'
);

-- Another User cannot see, change or delete it.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is((select count(*) from public.foods), 0::bigint, 'another User sees no Foods');

-- These match no rows for this User, so they change nothing.
update public.foods set calories = 1;
delete from public.foods;

select throws_ok(
  $$ insert into public.foods (user_id, name, portion, calories)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Planted', '1 piece', 50) $$,
  '42501', null, 'a User cannot add a Food for someone else'
);

-- Back to the first User: the Food is untouched.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select is(
  (select calories from public.foods where name = 'Sourdough toast'),
  110,
  'another User cannot change a Food'
);
select is(
  (select count(*) from public.foods where name = 'Sourdough toast'),
  1::bigint,
  'another User cannot delete a Food'
);

select throws_ok(
  $$ update public.foods set user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  '42501', null, 'a User cannot hand a Food to someone else'
);

-- Uniqueness: name and Portion, ignoring case and surrounding spaces.
select throws_ok(
  $$ insert into public.foods (name, portion, calories) values ('  SOURDOUGH toast ', '1 SLICE', 120) $$,
  '23505', null, 'the same name and Portion cannot be added twice, whatever the case'
);

select lives_ok(
  $$ insert into public.foods (name, portion, calories) values ('Sourdough toast', '2 slices', 220) $$,
  'the same name with a different Portion is a different Food'
);

-- Archiving frees the name and Portion for reuse.
update public.foods set archived_at = now() where name = 'Sourdough toast' and portion = '1 slice';
select lives_ok(
  $$ insert into public.foods (name, portion, calories) values ('Sourdough toast', '1 slice', 115) $$,
  'an Archived Food does not block a new one with the same name and Portion'
);

-- Bounds.
select throws_ok(
  $$ insert into public.foods (name, portion, calories) values ('Too rich', '1 piece', 10000) $$,
  '23514', null, 'calories above 9999 are rejected'
);
select throws_ok(
  $$ insert into public.foods (name, portion, calories) values ('Negative', '1 piece', -1) $$,
  '23514', null, 'negative calories are rejected'
);
select lives_ok(
  $$ insert into public.foods (name, portion, calories) values ('Water', '250 ml', 0) $$,
  'zero calories is allowed'
);
select throws_ok(
  $$ insert into public.foods (name, portion, calories) values ('   ', '1 piece', 10) $$,
  '23514', null, 'a blank name is rejected'
);
select throws_ok(
  $$ insert into public.foods (name, portion, calories) values (repeat('x', 81), '1 piece', 10) $$,
  '23514', null, 'a name over 80 characters is rejected'
);
select throws_ok(
  $$ insert into public.foods (name, portion, calories) values ('Okay', repeat('x', 41), 10) $$,
  '23514', null, 'a Portion over 40 characters is rejected'
);

-- updated_at moves forward when a Food changes.
reset role;
update public.foods set updated_at = '2000-01-01' where name = 'Water';
update public.foods set calories = 1 where name = 'Water';
select ok(
  (select updated_at > '2000-01-01' from public.foods where name = 'Water'),
  'updated_at is refreshed on update'
);

select * from finish();
rollback;
