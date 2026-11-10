-- Feedback sets (spec 193, Slice 1): a Round keeps 1 to 5 sets, each an enhancement or a bug; only
-- the server starts one; the old single-feedback overload still works; the sets stay private.
begin;
select plan(28);

-- Start from no requests, whatever earlier e2e runs left behind (rolled back at the end).
delete from public.feature_requests;

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'asker@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.test');

delete from public.toggles where key in ('feature-861', 'feature-862');
insert into public.toggles (key, title) values ('feature-861', 'Water tracking'), ('feature-862', 'Meal groups');

insert into public.feature_requests (id, user_id, goal, feature_issue, stage)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Track water as well as food', 861, 'ready_to_try'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Group foods into meals', 862, 'ready_to_try');

select has_column('public', 'feature_request_rounds', 'sets', 'a Round has sets');
select col_is_null('public', 'feature_request_rounds', 'sets', 'which are null for a Round sent before them (FR-006)');
select function_privs_are(
  'public', 'start_feature_request_round', array['uuid', 'uuid', 'jsonb'], 'authenticated', array[]::text[],
  'a User cannot start a Round with sets'
);
select function_privs_are(
  'public', 'start_feature_request_round', array['uuid', 'uuid', 'jsonb'], 'anon', array[]::text[],
  'nor can anyone signed out'
);
select function_privs_are(
  'public', 'start_feature_request_round', array['uuid', 'uuid', 'jsonb'], 'service_role', array['EXECUTE'],
  'only the server can'
);
select is(
  (select prosecdef from pg_proc
   where oid = 'public.start_feature_request_round(uuid, uuid, jsonb)'::regprocedure),
  true, 'it runs as its owner, so it can write Rounds'
);

-- Only the server may start a Round.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"asker@example.test"}', true);
set local role authenticated;
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"category": "bug", "text": "The glass button does nothing"}]'::jsonb) $$,
  '42501', null, 'a User cannot start a Round with sets through the API'
);
reset role;

set local role service_role;

-- US1.8: the server refuses anything but 1 to 5 good sets, and creates nothing.
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '[]'::jsonb) $$,
  '22023', 'invalid_feedback_sets', 'US1.8: no set is refused'
);
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       (select jsonb_agg('{"category": "enhancement", "text": "Let me add half a glass"}'::jsonb) from generate_series(1, 6))) $$,
  '22023', 'invalid_feedback_sets', 'US1.8: 6 sets are refused'
);
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"category": "bug", "text": "The glass button does nothing"}, {"category": "enhancement", "text": "  more   "}]'::jsonb) $$,
  '22023', 'invalid_feedback_sets', 'US1.8: a set under 10 characters after trimming is refused'
);
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       jsonb_build_array(jsonb_build_object('category', 'bug', 'text', repeat('x', 4001)))) $$,
  '22023', 'invalid_feedback_sets', 'US1.8: a set over 4,000 characters is refused'
);
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"category": "wish", "text": "Let me add half a glass"}]'::jsonb) $$,
  '22023', 'invalid_feedback_sets', 'US1.8: a category other than enhancement or bug is refused'
);
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '{"category": "bug", "text": "The glass button does nothing"}'::jsonb) $$,
  '22023', 'invalid_feedback_sets', 'sets that are not a list are refused'
);
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"category": "bug", "text": 12345678901}]'::jsonb) $$,
  '22023', 'invalid_feedback_sets', 'a set whose text is not text is refused'
);
select is(
  (select count(*)::integer from public.feature_request_rounds),
  0, 'US1.8: a refused send creates no Round'
);
select is(
  (select stage from public.feature_requests where feature_issue = 861),
  'ready_to_try', 'and leaves the request as it was'
);

-- US1.6: one Round keeps every set, trimmed and in order; feedback holds the first set's text.
select results_eq(
  $$ select round_number, goal, feature_issue from public.start_feature_request_round(
       '11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"category": "bug", "text": "  The glass button does nothing "},
         {"category": "enhancement", "text": "Let me add half a glass", "extra": true},
         {"category": "enhancement", "text": "Remember my usual glass size"}]'::jsonb) $$,
  $$ values (2, 'Track water as well as food', 861) $$,
  'US1.6: sets start Round 2 of the request'
);
select results_eq(
  $$ select feedback, sets from public.feature_request_rounds where request_id = '11111111-0000-0000-0000-000000000001' $$,
  $$ values ('The glass button does nothing',
       '[{"category": "bug", "text": "The glass button does nothing"},
         {"category": "enhancement", "text": "Let me add half a glass"},
         {"category": "enhancement", "text": "Remember my usual glass size"}]'::jsonb) $$,
  'US1.6: the Round keeps its sets in order, and feedback is the first set''s text'
);
select is(
  (select stage from public.feature_requests where feature_issue = 861),
  'submitted', 'US1.6: the request is back at Submitted'
);

-- FR-006: the old overload, which the deployed app calls, still works and stores no sets.
select results_eq(
  $$ select round_number from public.start_feature_request_round('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Let me name my meals'::text) $$,
  $$ values (2) $$,
  'FR-006: the single-feedback overload still starts a Round'
);
select is(
  (select sets from public.feature_request_rounds where request_id = '11111111-0000-0000-0000-000000000002'),
  null, 'FR-006: and stores no sets'
);

-- FR-005: the same guards as the single-feedback overload.
select is(
  (select count(*)::integer from public.start_feature_request_round(
     '11111111-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     '[{"category": "bug", "text": "The glass button does nothing"}]'::jsonb)),
  0, 'FR-005: no Round on someone else''s request'
);
update public.feature_requests set stage = 'ready_to_try' where feature_issue = 862;
insert into public.feature_requests (user_id, goal, feature_issue, stage)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Scan barcodes on packaged food', 863, 'building');
select throws_ok(
  $$ select * from public.start_feature_request_round('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"category": "bug", "text": "The glass button does nothing"}]'::jsonb) $$,
  '23514', 'feature_request_limit', 'FR-005: no Round while 2 other requests are being worked on'
);
delete from public.feature_requests where feature_issue = 863;
update public.feature_requests set withdrawn_at = now() where feature_issue = 862;
select is(
  (select count(*)::integer from public.start_feature_request_round(
     '11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '[{"category": "bug", "text": "The glass button does nothing"}]'::jsonb)),
  0, 'FR-005: no Round on a withdrawn request'
);
update public.feature_requests set withdrawn_at = null where feature_issue = 862;

-- FR-005: never on a decided request.
update public.feature_requests
set stage = 'ready_to_try', decision = 'ready'
where feature_issue = 862;
select is(
  (select count(*)::integer from public.start_feature_request_round(
     '11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '[{"category": "enhancement", "text": "Let me name my meals again"}]'::jsonb)),
  0, 'FR-005: no Round on a request whose decision is set'
);
update public.feature_requests set decision = null where feature_issue = 862;
update public.toggles set state = 'live' where key = 'feature-862';
select is(
  (select count(*)::integer from public.start_feature_request_round(
     '11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '[{"category": "bug", "text": "The glass button does nothing"}]'::jsonb)),
  0, 'FR-005: no Round once the Toggle has left Testing'
);
reset role;

-- FR-002: the Requester reads their sets; another User reads none of them.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"asker@example.test"}', true);
set local role authenticated;
select is(
  (select jsonb_array_length(sets) from public.feature_request_rounds where sets is not null),
  3, 'FR-002: the Requester reads their sets'
);
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","email":"other@example.test"}', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.feature_request_rounds where sets is not null),
  0, 'FR-002: another User reads none of the Requester''s sets'
);
reset role;

select * from finish();
rollback;
