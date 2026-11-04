-- remove_foods / restore_foods: removing many Foods at once (spec 014). A Food with Entries is
-- Archived, one without is deleted, the server decides at the moment of removal, and a User can
-- only ever touch their own Foods.
begin;
select plan(21);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories)
values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Eaten', '1 slice', 110),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Never eaten', '1 cup', 50),
  ('f1f1f1f1-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Also never eaten', '1 cup', 60),
  ('f1f1f1f1-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Late entry', '1 bar', 200),
  ('f2f2f2f2-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Theirs eaten', '100 g', 160),
  ('f2f2f2f2-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Theirs unused', '100 g', 70);

insert into public.entries (user_id, food_id, day, quantity)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f2f2f2f2-0000-0000-0000-000000000001', '2026-11-03', 1);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

-- One call, a mix: a Food with Entries, two without.
select results_eq(
  $$ select food_id, outcome from public.remove_foods(array[
       'f1f1f1f1-0000-0000-0000-000000000001',
       'f1f1f1f1-0000-0000-0000-000000000002',
       'f1f1f1f1-0000-0000-0000-000000000003'
     ]::uuid[]) order by food_id $$,
  $$ values
       ('f1f1f1f1-0000-0000-0000-000000000001'::uuid, 'archived'),
       ('f1f1f1f1-0000-0000-0000-000000000002'::uuid, 'deleted'),
       ('f1f1f1f1-0000-0000-0000-000000000003'::uuid, 'deleted') $$,
  'archives Foods that have Entries and deletes the rest, and says which'
);
select isnt(
  (select archived_at from public.foods where id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  null,
  'the Food with Entries is kept, with a time it was archived'
);
select is(
  (select count(*) from public.entries where food_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  1::bigint,
  'its Entries are untouched'
);
select is(
  (select count(*) from public.foods where id in (
     'f1f1f1f1-0000-0000-0000-000000000002', 'f1f1f1f1-0000-0000-0000-000000000003')),
  0::bigint,
  'the Foods without Entries are gone for good'
);

-- The server decides when it runs: an Entry logged since the User looked means Archive, not an error.
reset role;
insert into public.entries (user_id, food_id, day, quantity)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000004', '2026-11-04', 1);
set local role authenticated;
select is(
  (select outcome from public.remove_foods(array['f1f1f1f1-0000-0000-0000-000000000004']::uuid[])),
  'archived',
  'a Food that gained an Entry after the User last looked is archived, not deleted or refused'
);

select is(
  (select count(*) from public.remove_foods(array[]::uuid[])),
  0::bigint,
  'removing nothing does nothing'
);
select is(
  (select count(*) from public.remove_foods(array['99999999-9999-9999-9999-999999999999']::uuid[])),
  0::bigint,
  'an unknown id is ignored'
);

-- Another User's Foods are out of reach.
select is(
  (select count(*) from public.remove_foods(array[
     'f2f2f2f2-0000-0000-0000-000000000001', 'f2f2f2f2-0000-0000-0000-000000000002']::uuid[])),
  0::bigint,
  'another User''s Foods are not removed or reported'
);
reset role;
select is(
  (select count(*) from public.foods where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and archived_at is null),
  2::bigint,
  'and are exactly as they were'
);
set local role authenticated;

-- restore_foods
select results_eq(
  $$ select food_id from public.restore_foods(array[
       'f1f1f1f1-0000-0000-0000-000000000001',
       'f1f1f1f1-0000-0000-0000-000000000004']::uuid[]) order by food_id $$,
  $$ values
       ('f1f1f1f1-0000-0000-0000-000000000001'::uuid),
       ('f1f1f1f1-0000-0000-0000-000000000004'::uuid) $$,
  'restores every Archived Food it is given and says which'
);
select is(
  (select count(*) from public.foods where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and archived_at is null),
  2::bigint,
  'they are back in the Food List'
);
select is(
  (select count(*) from public.restore_foods(array['f1f1f1f1-0000-0000-0000-000000000001']::uuid[])),
  0::bigint,
  'a Food that is not Archived is not reported as restored'
);

-- Another User's Archived Foods cannot be restored.
reset role;
update public.foods set archived_at = now() where id = 'f2f2f2f2-0000-0000-0000-000000000001';
set local role authenticated;
select is(
  (select count(*) from public.restore_foods(array['f2f2f2f2-0000-0000-0000-000000000001']::uuid[])),
  0::bigint,
  'another User''s Archived Food is not restored'
);
reset role;
select isnt(
  (select archived_at from public.foods where id = 'f2f2f2f2-0000-0000-0000-000000000001'),
  null,
  'and stays Archived'
);
set local role authenticated;

-- A clash is refused, and nothing in the call is restored (spec 003 AC-9).
select public.remove_foods(array['f1f1f1f1-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-000000000004']::uuid[]);
insert into public.foods (id, name, portion, calories)
values ('f1f1f1f1-0000-0000-0000-000000000009', 'Eaten', '1 slice', 115);
select throws_ok(
  $$ select public.restore_foods(array[
       'f1f1f1f1-0000-0000-0000-000000000004',
       'f1f1f1f1-0000-0000-0000-000000000001']::uuid[]) $$,
  '23505',
  null,
  'restoring a Food whose name and Portion are now taken is refused'
);
select isnt(
  (select archived_at from public.foods where id = 'f1f1f1f1-0000-0000-0000-000000000004'),
  null,
  'and the others in that call stay Archived too'
);

-- Foods that were deleted can be put back with their own ids (Undo inserts them).
select lives_ok(
  $$ insert into public.foods (id, name, portion, calories)
     values ('f1f1f1f1-0000-0000-0000-000000000002', 'Never eaten', '1 cup', 50) $$,
  'a deleted Food can be re-created with its original id'
);

-- Signed out.
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.remove_foods(array['f1f1f1f1-0000-0000-0000-000000000002']::uuid[]) $$,
  '42501', null, 'anon cannot remove Foods'
);
select throws_ok(
  $$ select * from public.restore_foods(array['f1f1f1f1-0000-0000-0000-000000000002']::uuid[]) $$,
  '42501', null, 'anon cannot restore Foods'
);
reset role;

-- The deleted Foods really are gone in the other tests' view.
select is(
  (select count(*) from public.foods where id = 'f1f1f1f1-0000-0000-0000-000000000003'),
  0::bigint,
  'a deleted Food stays deleted'
);
select is(
  (select count(*) from public.foods where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  4::bigint,
  'the User has the Foods that were archived or put back, nothing else'
);

select * from finish();
rollback;
