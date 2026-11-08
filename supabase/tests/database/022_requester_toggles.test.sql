-- The Requester's switch (spec 124, Slice 3): a Requester may try their own feature's Toggle once
-- their request is Ready to try, until they withdraw it; the Owner still may too; nobody else may.
begin;
select plan(12);

-- Start from no requests, whatever earlier e2e runs left behind (rolled back at the end).
delete from public.feature_requests;

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'asker@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.test'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'owner@example.test');

insert into public.allowed_emails (email, note, is_owner)
values
  ('asker@example.test', 'test', false),
  ('other@example.test', 'test', false),
  ('owner@example.test', 'test', true);

delete from public.toggles where key in ('feature-701', 'feature-702');
insert into public.toggles (key, title) values ('feature-701', 'Water tracking'), ('feature-702', 'Meal groups');

insert into public.feature_requests (id, user_id, goal, feature_issue, stage)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Track water as well as food', 701, 'building'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Group foods into meals', 702, 'ready_to_try');

-- The Requester.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"asker@example.test"}', true);
set local role authenticated;

select is(public.can_try_toggle('feature-701'), false, 'US3.5: not before their request is Ready to try');
select throws_ok(
  $$ insert into public.toggle_overrides (toggle_key, enabled) values ('feature-701', true) $$,
  '42501', null, 'US3.5: so a half-built feature cannot be switched on through the API'
);
select is(public.can_try_toggle('feature-702'), true, 'US3.5: the Requester may try their feature once it is Ready to try');
select lives_ok(
  $$ insert into public.toggle_overrides (toggle_key, enabled) values ('feature-702', true) $$,
  'US3.5: and turn it on'
);
select is(public.toggle_is_on('feature-702'), true, 'US3.5: it is then on for them');
select is(public.can_try_toggle('feature-114'), false, 'a request gives no say over any other Toggle');
reset role;

-- Another User.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","email":"other@example.test"}', true);
set local role authenticated;
select is(public.toggle_is_on('feature-702'), false, 'US3.5: it is still off for everyone else');
select is(public.can_try_toggle('feature-702'), false, 'US3.5: who cannot switch it');
reset role;

-- The Owner keeps the switch spec 116 gave them.
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated","email":"owner@example.test"}', true);
set local role authenticated;
select is(public.can_try_toggle('feature-701'), true, 'the Owner may try any Toggle in Testing');
select is(public.can_try_toggle('feature-114'), true, 'including ones nobody requested');
reset role;

-- US3.6: withdrawing ends it.
update public.feature_requests set withdrawn_at = now() where feature_issue = 702;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"asker@example.test"}', true);
set local role authenticated;
select is(public.can_try_toggle('feature-702'), false, 'US3.6: a withdrawn request no longer lets its Requester switch');
select is(public.toggle_is_on('feature-702'), false, 'US3.6: and their override stops counting');
reset role;

select * from finish();
rollback;
