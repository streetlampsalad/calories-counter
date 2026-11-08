-- Rounds (spec 135, Slice 1): feedback starts another Round behind the same Toggle; the request
-- follows its newest Round; the Requester keeps their switch; Rounds are private to their Requester.
begin;
select plan(28);

-- Start from no requests, whatever earlier e2e runs left behind (rolled back at the end).
delete from public.feature_requests;

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'asker@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.test');

delete from public.toggles where key in ('feature-801', 'feature-802');
insert into public.toggles (key, title) values ('feature-801', 'Water tracking'), ('feature-802', 'Meal groups');

insert into public.feature_requests (id, user_id, goal, feature_issue, stage)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Track water as well as food', 801, 'building'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Group foods into meals', 802, 'planning');

select is(
  (select first_ready_at from public.feature_requests where feature_issue = 801),
  null, 'a request that has never been Ready to try has no first_ready_at'
);
update public.feature_requests set stage = 'ready_to_try' where feature_issue = 801;
select ok(
  (select first_ready_at is not null from public.feature_requests where feature_issue = 801),
  'first_ready_at is set the first time a request is Ready to try'
);

-- Only the server may start a Round.
set local role authenticated;
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Let me add half a glass') $$,
  '42501', null, 'a User cannot start a Round through the API'
);
select throws_ok(
  $$ insert into public.feature_request_rounds (request_id, feedback) values ('11111111-0000-0000-0000-000000000001', 'Let me add half a glass') $$,
  '42501', null, 'nor add one directly'
);
reset role;

set local role service_role;
select is(
  (select round_number from public.start_feature_request_round('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Let me add half a glass')),
  null, 'US1.8: no Round for a request that is not Ready to try'
);
select is(
  (select round_number from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Let me add half a glass')),
  null, 'nor for someone else''s request'
);
select results_eq(
  $$ select round_number, goal, feature_issue from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Let me add half a glass') $$,
  $$ values (2, 'Track water as well as food', 801) $$,
  'US1.3: feedback starts Round 2 of the request'
);
reset role;

select is(
  (select stage from public.feature_requests where feature_issue = 801),
  'submitted', 'US1.3: the request is back at Submitted'
);

-- While the Round's Issue is being created, the old Issue no longer moves the request.
set local role service_role;
select is(
  (select count(*)::integer from public.apply_feature_request_sync('[
     {"featureIssue": 801, "stage": "ready_to_try", "specIssue": 901, "latestComment": null, "readyNote": null}
   ]'::jsonb)),
  0, 'US1.4: a Round still being created holds the request where it is'
);
update public.feature_request_rounds set feature_issue = 811 where request_id = '11111111-0000-0000-0000-000000000001';
select is(
  (select count(*)::integer from public.apply_feature_request_sync('[
     {"featureIssue": 801, "stage": "ready_to_try", "specIssue": 901, "latestComment": "Old news", "readyNote": null}
   ]'::jsonb)),
  0, 'US1.4: an older Issue no longer changes the request'
);
select results_eq(
  $$ select new_stage, notify from public.apply_feature_request_sync('[
       {"featureIssue": 899, "stage": "not_going_ahead", "specIssue": null, "latestComment": "Spam", "readyNote": null},
       {"featureIssue": 811, "stage": "being_reviewed", "specIssue": null, "latestComment": "Accepted", "readyNote": null}
     ]'::jsonb) $$,
  $$ values ('being_reviewed', false) $$,
  'US1.4: the newest Round''s Issue moves the request, and an Issue the app never recorded, however new, changes nothing'
);
reset role;

select is(
  (select stage from public.feature_requests where feature_issue = 801),
  'being_reviewed', 'US1.4: the card follows the Round'
);
select is(
  (select spec_issue from public.feature_requests where feature_issue = 801),
  null, 'the request''s own Spec Issue is left as it was'
);

-- US1.6: the Requester keeps their switch while the Round is built.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"asker@example.test"}', true);
set local role authenticated;
select is(public.can_try_toggle('feature-801'), true, 'US1.6: the Requester can still switch during a Round');
select is(public.can_try_toggle('feature-802'), false, 'but not a Toggle whose request was never Ready to try');
select is(
  (select count(*)::integer from public.feature_request_rounds),
  1, 'US1.10: the Requester sees their Round'
);
reset role;

-- US1.10: another User sees none of it.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","email":"other@example.test"}', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.feature_request_rounds),
  0, 'US1.10: another User sees none of the Requester''s Rounds'
);
select is(public.can_try_toggle('feature-801'), false, 'nor gets a switch');
reset role;

-- US1.5: the Round reaching Ready to try notifies again.
set local role service_role;
select results_eq(
  $$ select new_stage, notify from public.apply_feature_request_sync('[
       {"featureIssue": 811, "stage": "ready_to_try", "specIssue": 812, "latestComment": "In production", "readyNote": "Tap Water, then Half a glass."}
     ]'::jsonb) $$,
  $$ values ('ready_to_try', true) $$,
  'US1.5: the Requester is notified when the Round is Ready to try'
);

-- US1.7: Round feedback counts towards the 2 open requests.
insert into public.feature_requests (user_id, goal, feature_issue, stage)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Scan barcodes on packaged food', 803, 'building');
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Remember my usual glass size') $$,
  '23514', 'feature_request_limit', 'US1.7: no Round while 2 other requests are being worked on'
);
delete from public.feature_requests where feature_issue = 803;

-- A Round that agents decline leaves the Requester able to decide (D13).
-- (Each Round is its own transaction in the app; here they share now(), so Round 2 is backdated.)
update public.feature_request_rounds set created_at = now() - interval '1 day' where feature_issue = 811;
select results_eq(
  $$ select round_number from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Remember my usual glass size') $$,
  $$ values (3) $$,
  'a later Round is numbered after the last'
);
update public.feature_request_rounds set feature_issue = 821 where feedback = 'Remember my usual glass size';
select is(
  (select new_stage from public.apply_feature_request_sync('[
     {"featureIssue": 821, "stage": "not_going_ahead", "specIssue": null, "latestComment": "Out of scope", "readyNote": null}
   ]'::jsonb)),
  'not_going_ahead', 'a Round can be declined'
);
select is(
  (select count(*)::integer from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Then just let me type millilitres')
   where round_number is not null),
  1, 'D13: after a declined Round, feedback can start another'
);

-- Undoing a Round whose Issue could not be created puts the request back as it was, in one go.
select lives_ok(
  $$ select public.undo_feature_request_round(
       (select id from public.feature_request_rounds where feedback = 'Then just let me type millilitres'),
       'not_going_ahead', '2026-11-01 00:00:00+00', 'Out of scope', null) $$,
  'the server can undo a Round'
);
select is(
  (select count(*)::integer from public.feature_request_rounds where request_id = '11111111-0000-0000-0000-000000000001'),
  2, 'the undone Round is gone'
);
select results_eq(
  $$ select stage, stage_changed_at, latest_comment from public.feature_requests where feature_issue = 801 $$,
  $$ values ('not_going_ahead', '2026-11-01 00:00:00+00'::timestamptz, 'Out of scope') $$,
  'and the request is back as it was'
);
set local role authenticated;
select throws_ok(
  $$ select public.undo_feature_request_round(gen_random_uuid(), 'submitted', now(), null, null) $$,
  '42501', null, 'a User cannot undo a Round'
);
set local role service_role;

-- US1.8: nothing once the Toggle has left Testing.
update public.feature_requests set stage = 'ready_to_try' where feature_issue = 801;
update public.toggles set state = 'live' where key = 'feature-801';
select is(
  (select round_number from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'One more thing please')),
  null, 'US1.8: no Round once the Toggle is Live'
);
reset role;

select * from finish();
rollback;
