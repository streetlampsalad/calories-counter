-- A reminder to decide (spec 135, Slice 4): once per Round, after 14 days at Ready to try with the
-- Toggle in Testing; never for a Toggle that is Live or Removed, a withdrawn request, or sooner.
begin;
select plan(9);

-- Start from no requests, whatever earlier e2e runs left behind (rolled back at the end).
delete from public.feature_requests;

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'asker@example.test');

delete from public.toggles where key in ('feature-871', 'feature-872', 'feature-873', 'feature-874', 'feature-875');
insert into public.toggles (key, title, state)
values
  ('feature-871', 'Water tracking', 'testing'),
  ('feature-872', 'Meal groups', 'testing'),
  ('feature-873', 'Barcodes', 'testing'),
  ('feature-874', 'Copy yesterday', 'testing'),
  ('feature-875', 'Recipes', 'testing');

insert into public.feature_requests (id, user_id, goal, feature_issue, stage, stage_changed_at, withdrawn_at)
values
  -- Due: 15 days at Ready to try.
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Track water as well as food', 871, 'ready_to_try', now() - interval '15 days', null),
  -- Not yet: 13 days.
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Group foods into meals', 872, 'ready_to_try', now() - interval '13 days', null),
  -- Its Toggle goes Live below.
  ('11111111-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Scan barcodes', 873, 'ready_to_try', now() - interval '20 days', null),
  -- Withdrawn.
  ('11111111-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Copy yesterday to today', 874, 'ready_to_try', now() - interval '20 days', now()),
  -- Being built, not Ready to try.
  ('11111111-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Save recipes', 875, 'building', now() - interval '20 days', null);
update public.toggles set state = 'live' where key = 'feature-873';

-- Only the server may ask.
set local role authenticated;
select throws_ok(
  $$ select * from public.due_testing_reminders() $$,
  '42501', null, 'a User cannot ask who is due a reminder'
);
reset role;

set local role service_role;
select results_eq(
  $$ select request_id, requester_id, goal_text from public.due_testing_reminders() $$,
  $$ values ('11111111-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Track water as well as food') $$,
  'US4.1, US4.3: only the request 14 days at Ready to try with its Toggle in Testing is due'
);
reset role;

select ok(
  (select testing_reminder_sent_at is not null from public.feature_requests where feature_issue = 871),
  'US4.2: the reminder is marked as sent'
);
select is(
  (select testing_reminder_sent_at from public.feature_requests where feature_issue = 872),
  null, 'US4.3: nothing is marked for a request not yet due'
);

set local role service_role;
select is(
  (select count(*)::integer from public.due_testing_reminders()),
  0, 'US4.2: nothing more is due for that Round'
);
reset role;

-- A later Round reaching Ready to try is due again, 14 days on.
update public.feature_requests
set testing_reminder_sent_at = now() - interval '30 days', stage_changed_at = now() - interval '14 days'
where feature_issue = 871;
set local role service_role;
select is(
  (select count(*)::integer from public.due_testing_reminders()),
  1, 'D7: each Round that stays Ready to try is reminded once'
);
reset role;

-- US4.3: a request 14 days at Ready to try that is withdrawn, Live or not Ready to try is never due.
update public.feature_requests set testing_reminder_sent_at = null where feature_issue = 871;
update public.feature_requests set stage_changed_at = now() - interval '13 days 23 hours' where feature_issue = 871;
set local role service_role;
select is(
  (select count(*)::integer from public.due_testing_reminders()),
  0, 'US4.3: not a moment before 14 days'
);
reset role;
select is(
  (select count(*)::integer from public.feature_requests where testing_reminder_sent_at is not null),
  0, 'US4.3: so nothing is marked'
);

-- The deployed app does not know the column; reading requests still works for their Requester.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"asker@example.test"}', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.feature_requests),
  5, 'the Requester still reads their requests'
);
reset role;

select * from finish();
rollback;
