-- Bug report sync (spec 194, Slice 3): only the server records outcomes; a mismatched Bug Issue
-- number changes nothing; a notification is due only on the change into Fixed or Not going ahead;
-- another User reads none of the outcomes or reasons.
begin;
select plan(16);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.test');

insert into public.bug_reports (id, user_id, bug_issue)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 701),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 702);

-- Only the server may sync.
set local role authenticated;
select throws_ok(
  $$ select * from public.apply_bug_report_sync('[]'::jsonb) $$,
  '42501', null, 'US3.3: a User cannot record outcomes'
);
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.apply_bug_report_sync('[]'::jsonb) $$,
  '42501', null, 'US3.3: nobody signed out can record outcomes'
);
reset role;

set local role service_role;

-- A mismatched Bug Issue number, or an unknown id, changes nothing.
select is(
  (select count(*) from public.apply_bug_report_sync('[
     {"id": "11111111-0000-0000-0000-000000000001", "bug_issue": 999, "outcome": "fixed", "issue_title": "Wrong Issue", "latest_comment": "No"},
     {"id": "11111111-0000-0000-0000-0000000000ff", "bug_issue": 701, "outcome": "fixed", "issue_title": "Wrong id", "latest_comment": "No"}
   ]'::jsonb)),
  0::bigint,
  'US3.3: a sync whose id and Bug Issue number do not both match returns nothing'
);

-- An ordinary change is recorded and notifies nobody.
select is(
  (select count(*) from public.apply_bug_report_sync('[
     {"id": "11111111-0000-0000-0000-000000000001", "bug_issue": 701, "outcome": "being_fixed", "issue_title": "Bug: it broke", "latest_comment": null}
   ]'::jsonb)),
  0::bigint,
  'US3.7: a change to Being fixed is not due a notification'
);
reset role;

select is(
  (select outcome from public.bug_reports where bug_issue = 999 or id = '11111111-0000-0000-0000-0000000000ff'),
  null,
  'US3.3: so the mismatched updates changed no row'
);
select is(
  (select outcome || '|' || issue_title from public.bug_reports where bug_issue = 701),
  'being_fixed|Bug: it broke',
  'US3.2: the outcome and Issue title are recorded'
);
select ok(
  (select outcome_changed_at > now() - interval '1 minute' from public.bug_reports where bug_issue = 701),
  'and the time the outcome changed'
);

-- The same outcome again does not move the time.
update public.bug_reports set outcome_changed_at = now() - interval '2 days' where bug_issue = 701;
set local role service_role;
select is(
  (select count(*) from public.apply_bug_report_sync('[
     {"id": "11111111-0000-0000-0000-000000000001", "bug_issue": 701, "outcome": "being_fixed", "issue_title": "Bug: it broke (renamed)", "latest_comment": "On it"}
   ]'::jsonb)),
  0::bigint,
  'US3.7: the same outcome again is not due a notification'
);
reset role;
select ok(
  (select outcome_changed_at < now() - interval '1 day' from public.bug_reports where bug_issue = 701),
  'and does not move the time the outcome changed'
);
select is(
  (select issue_title || '|' || latest_comment from public.bug_reports where bug_issue = 701),
  'Bug: it broke (renamed)|On it',
  'but the Issue title and latest comment are kept current'
);

-- The change into Fixed or Not going ahead is due a notification, once.
set local role service_role;
select results_eq(
  $$ select id, user_id, new_outcome, issue_title, latest_comment from public.apply_bug_report_sync('[
       {"id": "11111111-0000-0000-0000-000000000001", "bug_issue": 701, "outcome": "fixed", "issue_title": "Bug: it broke", "latest_comment": "Fixed in the latest version."},
       {"id": "11111111-0000-0000-0000-000000000002", "bug_issue": 702, "outcome": "not_going_ahead", "issue_title": "Bug: it is slow", "latest_comment": "That is how it is meant to work."}
     ]'::jsonb) order by id $$,
  $$ values
       ('11111111-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'fixed', 'Bug: it broke', 'Fixed in the latest version.'),
       ('11111111-0000-0000-0000-000000000002'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'not_going_ahead', 'Bug: it is slow', 'That is how it is meant to work.') $$,
  'US3.7: moving into Fixed or Not going ahead returns the row to notify'
);
select is(
  (select count(*) from public.apply_bug_report_sync('[
     {"id": "11111111-0000-0000-0000-000000000001", "bug_issue": 701, "outcome": "fixed", "issue_title": "Bug: it broke", "latest_comment": "Fixed in the latest version."},
     {"id": "11111111-0000-0000-0000-000000000002", "bug_issue": 702, "outcome": "not_going_ahead", "issue_title": "Bug: it is slow", "latest_comment": "That is how it is meant to work."}
   ]'::jsonb)),
  0::bigint,
  'US3.7: the same sync again returns nothing'
);
select throws_ok(
  $$ select * from public.apply_bug_report_sync('[
       {"id": "11111111-0000-0000-0000-000000000001", "bug_issue": 701, "outcome": "invented", "issue_title": "x", "latest_comment": null}
     ]'::jsonb) $$,
  '23514', null, 'an outcome the app does not know is refused'
);
reset role;

-- US3.9: the owner reads their outcome and reason; another User reads none.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select outcome, latest_comment from public.bug_reports where bug_issue = 702 $$,
  $$ values ('not_going_ahead', 'That is how it is meant to work.') $$,
  'US3.5: a User reads the outcome and reason of their own report'
);
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.bug_reports where outcome is not null or latest_comment is not null or issue_title is not null),
  0::bigint,
  'US3.9: another User reads none of the outcomes, titles or reasons'
);
reset role;

select is(
  (select count(*) from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'bug_reports' and grantee = 'authenticated'
     and privilege_type in ('INSERT', 'UPDATE')),
  0::bigint,
  'US3.9: and a User cannot write any column, the new ones included'
);

select * from finish();
rollback;
