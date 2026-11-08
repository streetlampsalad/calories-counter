-- It's ready (spec 135, Slice 2): only the server records a decision, only for the Requester's own
-- request that has been Ready to try, and the Toggle leaves Testing once, for everyone.
begin;
select plan(13);

-- Start from no requests, whatever earlier e2e runs left behind (rolled back at the end).
delete from public.feature_requests;

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'asker@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.test');

delete from public.toggles where key in ('feature-851', 'feature-852');
insert into public.toggles (key, title) values ('feature-851', 'Water tracking'), ('feature-852', 'Meal groups');

insert into public.feature_requests (id, user_id, goal, feature_issue, stage)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Track water as well as food', 851, 'ready_to_try'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Group foods into meals', 852, 'building');

-- Only the server may decide.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"asker@example.test"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.decide_feature_request('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ready', 901) $$,
  '42501', null, 'a User cannot decide through the API'
);
select throws_ok(
  $$ update public.toggles set state = 'live' where key = 'feature-851' $$,
  '42501', null, 'nor change a Toggle''s state (D10)'
);
reset role;

set local role service_role;
select is(
  public.decide_feature_request('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ready', 901),
  false, 'another User cannot decide on the Requester''s request'
);
select is(
  public.decide_feature_request('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ready', 901),
  false, 'nor can the Requester before it has been Ready to try'
);
select is(
  (select state from public.toggles where key = 'feature-852'),
  'testing', 'which leaves its Toggle in Testing'
);

select is(
  public.decide_feature_request('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ready', 901),
  true, 'US2.1: the Requester marks it ready'
);
reset role;

select is(
  (select state from public.toggles where key = 'feature-851'),
  'live', 'US2.1: its Toggle is Live'
);
select results_eq(
  $$ select decision, cleanup_issue from public.feature_requests where feature_issue = 851 $$,
  $$ values ('ready', 901) $$,
  'US2.1: the decision and its Chore are recorded'
);

-- US2.3: the Toggle can only leave Testing once.
set local role service_role;
select is(
  public.decide_feature_request('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ready', 902),
  false, 'US2.3: a second decision changes nothing'
);
reset role;
select is(
  (select cleanup_issue from public.feature_requests where feature_issue = 851),
  901, 'US2.3: and keeps the first Chore'
);

-- US2.3: a Toggle that left Testing some other way (the Owner, or another phone) is not decided again.
update public.feature_requests set stage = 'ready_to_try' where feature_issue = 852;
update public.toggles set state = 'removed' where key = 'feature-852';
set local role service_role;
select is(
  public.decide_feature_request('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ready', 903),
  false, 'US2.3: nothing is decided once the Toggle is no longer in Testing'
);
reset role;
select is(
  (select decision from public.feature_requests where feature_issue = 852),
  null, 'US2.3: and nothing is recorded'
);

-- Everyone sees it on.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","email":"other@example.test"}', true);
set local role authenticated;
select is(public.toggle_is_on('feature-851'), true, 'US2.1: a Live feature is on for every User');
reset role;

select * from finish();
rollback;
