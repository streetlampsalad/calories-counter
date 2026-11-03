-- Entries: private to their User, tied to the User's own Foods, with sane Quantities,
-- and a Food that has Entries can never be deleted (ADR 0001).
begin;
select plan(19);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories)
values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rice', '100 g', 130),
  ('f2f2f2f2-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pasta', '100 g', 160);

-- Act as the first User.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

insert into public.entries (food_id, day, quantity)
values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1.5);

select is(
  (select user_id from public.entries limit 1),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'a new Entry belongs to the signed-in User by default'
);

select is(
  (select day from public.entries limit 1),
  '2026-11-03'::date,
  'an Entry stores a plain calendar date'
);

-- Quantity rules.
select lives_ok(
  $$ insert into public.entries (food_id, day, quantity)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 0.5) $$,
  'half a Portion is allowed'
);
select lives_ok(
  $$ insert into public.entries (food_id, day, quantity)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 20) $$,
  '20 Portions is the most allowed'
);
select throws_ok(
  $$ insert into public.entries (food_id, day, quantity)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 20.5) $$,
  '23514', null, 'more than 20 Portions is refused'
);
select throws_ok(
  $$ insert into public.entries (food_id, day, quantity)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 0) $$,
  '23514', null, 'zero Portions is refused'
);
select throws_ok(
  $$ insert into public.entries (food_id, day, quantity)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1.3) $$,
  '23514', null, 'quantities move in half-portion steps'
);
select throws_ok(
  $$ insert into public.entries (food_id, day, quantity)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', -1) $$,
  '23514', null, 'a negative Quantity is refused'
);

-- The same Food twice on one Day is two Entries (spec 008).
select lives_ok(
  $$ insert into public.entries (food_id, day, quantity)
     values ('f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1) $$,
  'the same Food can be logged twice on one Day'
);

-- Cannot log another User's Food.
select throws_ok(
  $$ insert into public.entries (food_id, day, quantity)
     values ('f2f2f2f2-0000-0000-0000-000000000001', '2026-11-03', 1) $$,
  '42501', null, 'a User cannot log a Food that belongs to someone else'
);

-- Counts reflect real Entries.
select is(
  (select entry_count from public.food_entry_counts() where food_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  4::bigint,
  'food_entry_counts counts a Food''s Entries'
);
select is(
  (select entry_count from public.food_entry_counts() where food_id = 'f1f1f1f1-0000-0000-0000-000000000002'),
  0::bigint,
  'a Food with no Entries counts zero'
);

-- A Food with Entries cannot be deleted.
select throws_ok(
  $$ delete from public.foods where id = 'f1f1f1f1-0000-0000-0000-000000000001' $$,
  '23503', null, 'a Food that has Entries cannot be deleted'
);
select lives_ok(
  $$ delete from public.foods where id = 'f1f1f1f1-0000-0000-0000-000000000002' $$,
  'a Food without Entries can be deleted'
);

-- Another User sees and changes nothing.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is((select count(*) from public.entries), 0::bigint, 'another User sees no Entries');

update public.entries set quantity = 9;
delete from public.entries;

select throws_ok(
  $$ insert into public.entries (user_id, food_id, day, quantity)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1) $$,
  '42501', null, 'a User cannot add an Entry for someone else'
);

-- Back to the first User: untouched.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select is(
  (select count(*) from public.entries),
  4::bigint,
  'another User could not change or delete Entries'
);

select throws_ok(
  $$ update public.entries set food_id = 'f2f2f2f2-0000-0000-0000-000000000001' $$,
  '42501', null, 'an Entry cannot be re-pointed at someone else''s Food'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.entries $$,
  '42501', null, 'anon cannot read Entries'
);
reset role;

select * from finish();
rollback;
