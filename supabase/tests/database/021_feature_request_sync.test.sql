-- Feature Request sync (spec 124, Slice 2): only the server records stages; a notification is due
-- only on the change into Ready to try or Not going ahead; others' requests show without who asked.
begin;
select plan(19);

-- Start from no requests, whatever earlier e2e runs left behind (rolled back at the end).
delete from public.feature_requests;

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'asker@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.test');

insert into public.feature_requests (id, user_id, goal, feature_issue, created_at)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Track water as well as food', 501, now() - interval '3 days'),
  ('11111111-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Scan barcodes for packaged food', 502, now() - interval '2 days'),
  ('11111111-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Group foods into meals', 503, now() - interval '1 day');
insert into public.feature_requests (id, user_id, goal, feature_issue, withdrawn_at)
values ('11111111-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Copy yesterday to today', 504, now());

-- Only the server may sync.
set local role authenticated;
select throws_ok(
  $$ select * from public.apply_feature_request_sync('[]'::jsonb) $$,
  '42501', null, 'a User cannot record stages'
);
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.apply_feature_request_sync('[]'::jsonb) $$,
  '42501', null, 'nobody signed out can record stages'
);
reset role;

set local role service_role;
select results_eq(
  $$ select request_id, notify from public.apply_feature_request_sync('[
       {"featureIssue": 501, "stage": "planning", "specIssue": 601, "latestComment": "Accepted: specified in #601", "readyNote": null},
       {"featureIssue": 999, "stage": "building", "specIssue": null, "latestComment": null, "readyNote": null}
     ]'::jsonb) $$,
  $$ values ('11111111-0000-0000-0000-000000000001'::uuid, false) $$,
  'a sync updates requests by their Feature Issue and ignores Issues the app does not know'
);
reset role;

select is(
  (select stage from public.feature_requests where feature_issue = 501),
  'planning', 'the stage is recorded'
);
select is(
  (select spec_issue from public.feature_requests where feature_issue = 501),
  601, 'the Spec Issue is recorded'
);
select is(
  (select latest_comment from public.feature_requests where feature_issue = 501),
  'Accepted: specified in #601', 'the latest comment is recorded'
);
select ok(
  (select stage_changed_at > now() - interval '1 minute' from public.feature_requests where feature_issue = 501),
  'a new stage stamps when it changed'
);

set local role service_role;
-- US3.1: the change into Ready to try is due a notification, once.
select results_eq(
  $$ select request_id, requester_id, new_stage, notify from public.apply_feature_request_sync('[
       {"featureIssue": 501, "stage": "ready_to_try", "specIssue": 601, "latestComment": "In production", "readyNote": "Open Settings."}
     ]'::jsonb) $$,
  $$ values ('11111111-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'ready_to_try', true) $$,
  'US3.1: moving into Ready to try is due a notification'
);
select results_eq(
  $$ select notify from public.apply_feature_request_sync('[
       {"featureIssue": 501, "stage": "ready_to_try", "specIssue": 601, "latestComment": "In production", "readyNote": "Open Settings."}
     ]'::jsonb) $$,
  $$ values (false) $$,
  'US3.3: the same stage again is not'
);
-- US3.2: the change into Not going ahead is due one too; other stages are not.
select results_eq(
  $$ select request_id, notify from public.apply_feature_request_sync('[
       {"featureIssue": 502, "stage": "being_reviewed", "specIssue": null, "latestComment": null, "readyNote": null},
       {"featureIssue": 503, "stage": "not_going_ahead", "specIssue": null, "latestComment": "Duplicate of #12", "readyNote": null}
     ]'::jsonb) order by request_id $$,
  $$ values ('11111111-0000-0000-0000-000000000002'::uuid, false), ('11111111-0000-0000-0000-000000000003'::uuid, true) $$,
  'US3.2, US3.3: Not going ahead is due a notification, Being reviewed is not'
);
-- US4.3: a withdrawn request keeps its stage and is never due a notification.
select is(
  (select count(*) from public.apply_feature_request_sync('[
     {"featureIssue": 504, "stage": "not_going_ahead", "specIssue": null, "latestComment": "Withdrawn by the requester.", "readyNote": null}
   ]'::jsonb)),
  0::bigint,
  'US4.3: a sync leaves a withdrawn request alone'
);
reset role;
select is(
  (select stage from public.feature_requests where feature_issue = 504),
  'submitted', 'US4.3: so it stays as it was when withdrawn'
);
select is(
  (select ready_note from public.feature_requests where feature_issue = 501),
  'Open Settings.', 'the Ready to try note is recorded'
);

-- US2.4: others' requests, without who asked.
update public.feature_requests set stage = 'building' where feature_issue = 502;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select goal, stage from public.other_feature_requests() $$,
  $$ values ('Scan barcodes for packaged food', 'building') $$,
  'US2.4: a User sees other Users'' requests in progress, but not those Not going ahead'
);
select is(
  (select count(*) from public.other_feature_requests() where id = '11111111-0000-0000-0000-000000000001'),
  0::bigint,
  'and not their own'
);
reset role;
select is(
  (select count(*) from information_schema.parameters
   where specific_schema = 'public' and specific_name like 'other_feature_requests%'
     and parameter_mode = 'OUT' and parameter_name in ('user_id', 'problem', 'details')),
  0::bigint,
  'US2.4: other Users'' requests never include who asked, or their problem and details'
);

set local role anon;
select throws_ok(
  $$ select * from public.other_feature_requests() $$,
  '42501', null, 'nobody signed out sees requests'
);
reset role;

-- Requests ahead: others' Submitted or Being reviewed, made earlier, for the owner of the request only.
update public.feature_requests set stage = 'submitted' where feature_issue = 502;
insert into public.feature_requests (id, user_id, goal, feature_issue)
values ('11111111-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Show a weekly summary', 505);
set local role authenticated;
select is(
  public.feature_requests_ahead('11111111-0000-0000-0000-000000000005'),
  1,
  'one request is ahead (502 is Submitted; 501 is Ready to try, 503 Not going ahead, 504 withdrawn)'
);
select is(
  public.feature_requests_ahead('11111111-0000-0000-0000-000000000002'),
  null::integer,
  'nobody learns about the queue from someone else''s request'
);
reset role;

select * from finish();
rollback;
