-- Bug reports (spec 194, Slice 1): private to the User who sent them, written only by the server,
-- and at most 5 in any 24 hours.
begin;
select plan(14);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@example.test');

select is(
  (select state from public.toggles where key = 'feature-192'),
  'testing',
  'the Toggle feature-192 is in Testing'
);
select is(
  (select title from public.toggles where key = 'feature-192'),
  'Report a bug',
  'and is titled Report a bug'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.bug_reports'::regclass),
  true,
  'US1.11: bug_reports has RLS enabled'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'bug_reports'),
  1::bigint,
  'US1.11: and one policy, to read'
);
select ok(
  (select prosrc from pg_proc where proname = 'bug_reports_daily_limit' and pronamespace = 'public'::regnamespace)
    like '%pg_advisory_xact_lock(hashtext(''bug_reports:'' || new.user_id::text))%',
  'FR-005: the limit takes a per-User advisory lock, so two sends at once queue'
);

-- The server (service role) writes rows.
insert into public.bug_reports (id, user_id, bug_issue)
values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 301);
insert into public.bug_reports (user_id, bug_issue, created_at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 302, now() - interval '25 hours');
insert into public.bug_reports (user_id, bug_issue)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 303),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 304),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 305);

select lives_ok(
  $$ insert into public.bug_reports (user_id, bug_issue)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 306) $$,
  'US1.9: the fifth report in 24 hours is accepted; one older than 24 hours does not count'
);
select throws_ok(
  $$ insert into public.bug_reports (user_id, bug_issue)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 307) $$,
  '23514', 'bug_report_limit', 'US1.9: the sixth is refused'
);
select lives_ok(
  $$ insert into public.bug_reports (user_id, bug_issue)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 308) $$,
  'another User has their own 5'
);

-- The reporter reads their own and writes nothing.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.bug_reports), 6::bigint, 'a User sees all of their own Bug reports');
select throws_ok(
  $$ insert into public.bug_reports (user_id, bug_issue)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 309) $$,
  '42501', null, 'FR-006: a User cannot add a Bug report through the API; the server does'
);
select throws_ok(
  $$ update public.bug_reports set bug_issue = 999 $$,
  '42501', null, 'a User cannot change a Bug report'
);
select throws_ok(
  $$ delete from public.bug_reports $$,
  '42501', null, 'a User cannot delete a Bug report'
);
reset role;

-- US1.11: another User sees only theirs.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(bug_issue) from public.bug_reports),
  array[308],
  'US1.11: another User sees only their own Bug report'
);
reset role;

set local role anon;
select throws_ok(
  $$ select * from public.bug_reports $$,
  '42501', null, 'nobody signed out can read Bug reports'
);
reset role;

select * from finish();
rollback;
