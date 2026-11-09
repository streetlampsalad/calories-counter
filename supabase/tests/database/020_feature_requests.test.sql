-- Feature Requests (spec 124, Slice 1): private to their Requester, written only by the server,
-- and at most 2 at a time that agents are still working on.
begin;
select plan(17);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'asker@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.test');

select is(
  (select state from public.toggles where key = 'feature-114'),
  'live',
  'the Toggle feature-114 is Live, so Feature Requests are on for everyone'
);

-- The server (service role) writes rows; a goal must say something.
select throws_ok(
  $$ insert into public.feature_requests (user_id, goal)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'too short') $$,
  '23514', null, 'US1.3: a goal needs at least 10 characters'
);
select throws_ok(
  $$ insert into public.feature_requests (user_id, goal, stage)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Track water as well as food', 'live') $$,
  '23514', null, 'Live is never stored; it comes from the Toggle'
);

insert into public.feature_requests (id, user_id, goal)
values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Track water as well as food');

select is(
  (select stage from public.feature_requests where id = '11111111-0000-0000-0000-000000000001'),
  'submitted',
  'a new request is Submitted'
);

insert into public.feature_requests (user_id, goal, stage)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Group foods into meals', 'building');

-- US1.7: a third open request is refused.
select throws_ok(
  $$ insert into public.feature_requests (user_id, goal)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Show a weekly email summary') $$,
  '23514', 'feature_request_limit', 'US1.7: a User has at most 2 requests agents are working on'
);
select throws_ok(
  $$ insert into public.feature_requests (user_id, goal, stage)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Show a weekly email summary', 'waiting_for_owner') $$,
  '23514', 'feature_request_limit', 'Waiting for the owner counts as open'
);

-- US4.4: withdrawn requests, and those agents have finished with, do not count.
update public.feature_requests set withdrawn_at = now() where id = '11111111-0000-0000-0000-000000000001';
select lives_ok(
  $$ insert into public.feature_requests (id, user_id, goal)
     values ('11111111-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Show a weekly email summary') $$,
  'US4.4: a withdrawn request does not count towards the 2'
);
update public.feature_requests set stage = 'ready_to_try' where id = '11111111-0000-0000-0000-000000000003';
select lives_ok(
  $$ insert into public.feature_requests (user_id, goal)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Copy yesterday''s Entries to today') $$,
  'a request at Ready to try does not count towards the 2'
);

-- Another User's limit is their own.
select lives_ok(
  $$ insert into public.feature_requests (user_id, goal)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Scan barcodes for packaged food') $$,
  'another User has their own 2'
);

-- The Requester reads their own and writes nothing.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.feature_requests), 4::bigint, 'a Requester sees all of their own requests');
select is(
  (select count(*) from public.feature_requests where user_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'US1.10: and none of anyone else''s'
);
select throws_ok(
  $$ insert into public.feature_requests (user_id, goal)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Add requests myself') $$,
  '42501', null, 'a User cannot add a request through the API; the server does'
);
select throws_ok(
  $$ update public.feature_requests set stage = 'ready_to_try' $$,
  '42501', null, 'a User cannot move their own request on'
);
select throws_ok(
  $$ delete from public.feature_requests $$,
  '42501', null, 'a User cannot delete a request'
);
reset role;

-- US1.10: the other User sees only theirs.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.feature_requests), 1::bigint, 'US1.10: another User sees only their own request');
select is(
  (select goal from public.feature_requests),
  'Scan barcodes for packaged food',
  'US1.10: and it is theirs'
);
reset role;

set local role anon;
select throws_ok(
  $$ select * from public.feature_requests $$,
  '42501', null, 'nobody signed out can read requests'
);
reset role;

select * from finish();
rollback;
