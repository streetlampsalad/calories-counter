-- Toggles (spec 116, ADR 0008): one database answer to "is this Toggle on for me?",
-- Testing only for the Owner, overrides private to their User, and states that only move forward.
begin;
select plan(35);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'friend@example.test');

insert into public.allowed_emails (email, note, is_owner)
values
  ('owner@example.test', 'test', true),
  ('friend@example.test', 'test', false);

-- Start from no Toggles, whatever the seed added (rolled back at the end).
delete from public.toggles;

insert into public.toggles (key, title, state)
values
  ('feature-1', 'In testing', 'testing'),
  ('feature-2', 'Live for everyone', 'live'),
  ('feature-3', 'Being removed', 'removed');

-- Keys name a Feature Issue, titles are short, and a new Toggle starts in Testing.
select throws_ok(
  $$ insert into public.toggles (key, title) values ('dark-mode', 'Dark mode') $$,
  '23514', null, 'a key must be feature-<Feature Issue number>'
);
select throws_ok(
  $$ insert into public.toggles (key, title) values ('feature-9', '  ') $$,
  '23514', null, 'a Toggle needs a title'
);
select throws_ok(
  $$ insert into public.toggles (key, title, state) values ('feature-9', 'x', 'beta') $$,
  '23514', null, 'a state is testing, live or removed'
);
insert into public.toggles (key, title) values ('feature-4', 'Starts in testing');
select is(
  (select state from public.toggles where key = 'feature-4'),
  'testing',
  'a new Toggle is in Testing'
);

-- A User who is not the Owner.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","email":"friend@example.test"}', true);
set local role authenticated;

select is(public.toggle_is_on('feature-999'), false, 'US1.1: a missing Toggle is off');
select is(public.is_owner(), false, 'a friend is not the Owner');
select is(public.toggle_is_on('feature-1'), false, 'US1.2: a Toggle in Testing is off for a friend');
select throws_ok(
  $$ insert into public.toggle_overrides (toggle_key, enabled) values ('feature-1', true) $$,
  '42501', null, 'US1.2: a friend cannot turn on a Toggle in Testing'
);
select is(
  (select count(*) from public.toggles),
  4::bigint,
  'every User can see which Toggles exist'
);
select throws_ok(
  $$ update public.toggles set state = 'live' where key = 'feature-1' $$,
  '42501', null, 'a User cannot change a Toggle''s state'
);
select throws_ok(
  $$ insert into public.toggles (key, title) values ('feature-8', 'Sneaky') $$,
  '42501', null, 'a User cannot add a Toggle'
);
select throws_ok(
  $$ delete from public.toggles $$,
  '42501', null, 'a User cannot delete Toggles'
);
reset role;

-- The Owner.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"owner@example.test"}', true);
set local role authenticated;

select is(public.is_owner(), true, 'the Owner is recognised by their email');
select is(public.toggle_is_on('feature-1'), false, 'a Toggle in Testing starts off for the Owner too');
select lives_ok(
  $$ insert into public.toggle_overrides (toggle_key, enabled) values ('feature-1', true) $$,
  'US1.3: the Owner can turn on a Toggle in Testing'
);
select is(public.toggle_is_on('feature-1'), true, 'US1.3: it is then on for the Owner');
select is(
  (select user_id from public.toggle_overrides where toggle_key = 'feature-1'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'an override belongs to the signed-in User by default'
);
select throws_ok(
  $$ insert into public.toggle_overrides (toggle_key, enabled) values ('feature-2', false) $$,
  '42501', null, 'a Live Toggle cannot be switched'
);
select throws_ok(
  $$ insert into public.toggle_overrides (toggle_key, enabled) values ('feature-3', true) $$,
  '42501', null, 'a Removed Toggle cannot be switched'
);
select results_eq(
  $$ select key, state, is_on, can_switch from public.my_toggles() order by key $$,
  $$ values ('feature-1', 'testing', true, true), ('feature-2', 'live', true, false),
            ('feature-3', 'removed', false, false), ('feature-4', 'testing', false, true) $$,
  'my_toggles() gives the Owner each Toggle, whether it is on, and whether they can switch it'
);
reset role;

-- Overrides left over on Live and Removed Toggles change nothing.
insert into public.toggle_overrides (toggle_key, user_id, enabled)
values
  ('feature-2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false),
  ('feature-3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- Back to the friend.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","email":"friend@example.test"}', true);
set local role authenticated;

select is(public.toggle_is_on('feature-1'), false, 'US1.3: the Owner turning it on leaves it off for everyone else');
select is(public.toggle_is_on('feature-2'), true, 'US1.4: a Live Toggle is on for every User');
select results_eq(
  $$ select key, is_on, can_switch from public.my_toggles() order by key $$,
  $$ values ('feature-1', false, false), ('feature-2', true, false),
            ('feature-3', false, false), ('feature-4', false, false) $$,
  'my_toggles() gives a friend nothing to switch'
);

-- US1.6: another User's overrides are invisible and untouchable.
select is((select count(*) from public.toggle_overrides), 0::bigint, 'US1.6: a friend sees none of the Owner''s overrides');
update public.toggle_overrides set enabled = false;
delete from public.toggle_overrides;
select throws_ok(
  $$ insert into public.toggle_overrides (toggle_key, user_id, enabled)
     values ('feature-4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true) $$,
  '42501', null, 'US1.6: a User cannot add an override for someone else'
);
reset role;

select is(
  (select count(*) from public.toggle_overrides where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and enabled = (toggle_key <> 'feature-2')),
  3::bigint,
  'US1.6: the friend''s update and delete left the Owner''s overrides as they were'
);

-- The Owner again: Live wins over an override, Removed is off whatever the override says.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"owner@example.test"}', true);
set local role authenticated;
select is(public.toggle_is_on('feature-2'), true, 'US1.4: Live is on even where the override says off');
select is(public.toggle_is_on('feature-3'), false, 'US1.5: Removed is off even where the override says on');
reset role;

-- US1.8: someone who stops being the Owner loses their Testing overrides' effect.
update public.allowed_emails set is_owner = false where email = 'owner@example.test';
set local role authenticated;
select is(public.toggle_is_on('feature-1'), false, 'US1.8: no longer the Owner, so the Toggle is off for them');
reset role;
update public.allowed_emails set is_owner = true where email = 'owner@example.test';

-- US1.5: a Toggle the Owner turned on goes off for them once it is Removed.
update public.toggles set state = 'removed' where key = 'feature-1';
set local role authenticated;
select is(public.toggle_is_on('feature-1'), false, 'US1.5: Removed is off for a User who had turned it on');
reset role;

-- US1.7: states only move forward.
select throws_ok(
  $$ update public.toggles set state = 'testing' where key = 'feature-2' $$,
  '23514', null, 'US1.7: a Live Toggle cannot go back to Testing'
);
select throws_ok(
  $$ update public.toggles set state = 'removed' where key = 'feature-2' $$,
  '23514', null, 'US1.7: a Live Toggle cannot be Removed'
);
select throws_ok(
  $$ update public.toggles set state = 'testing' where key = 'feature-3' $$,
  '23514', null, 'US1.7: a Removed Toggle cannot come back'
);
select lives_ok(
  $$ update public.toggles set state = 'live' where key = 'feature-4' $$,
  'Testing can move to Live'
);

-- Nobody signed out can ask.
set local role anon;
select throws_ok(
  $$ select public.toggle_is_on('feature-2') $$,
  '42501', null, 'anon cannot ask whether a Toggle is on'
);
reset role;

select * from finish();
rollback;
