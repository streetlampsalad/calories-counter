-- Reminders (spec 016): private push subscriptions, a bounded Reminder time, and due_reminders
-- answering "who is due now?" correctly across time zones, daylight saving and logged Days.
begin;
select plan(34);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories)
values ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110);

-- ---------------------------------------------------------------------------------------------
-- Reminder settings.
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

insert into public.user_settings (daily_goal_calories) values (2200);

select is(
  (select reminder_enabled from public.user_settings),
  false,
  'the Reminder is off by default'
);
select is(
  (select reminder_time from public.user_settings),
  '19:00'::time,
  'the Reminder defaults to 7:00 pm'
);
select lives_ok(
  $$ update public.user_settings set reminder_time = '06:45' $$,
  'a time on a quarter hour is allowed'
);
select throws_ok(
  $$ update public.user_settings set reminder_time = '06:50' $$,
  '23514', null, 'a time off a quarter hour is refused'
);
select throws_ok(
  $$ update public.user_settings set reminder_time = '06:45:30' $$,
  '23514', null, 'a time with seconds is refused'
);
select throws_ok(
  $$ update public.user_settings set reminder_enabled = true $$,
  '23514', null, 'a Reminder cannot be on without a time zone'
);
select throws_ok(
  $$ update public.user_settings set time_zone = 'Mars/Olympus_Mons' $$,
  '22023', null, 'an unknown time zone is refused'
);
select lives_ok(
  $$ update public.user_settings set time_zone = 'Australia/Sydney', reminder_enabled = true $$,
  'a Reminder can be turned on with a real time zone'
);

-- ---------------------------------------------------------------------------------------------
-- Push subscriptions are private.
-- ---------------------------------------------------------------------------------------------
insert into public.push_subscriptions (endpoint, p256dh, auth)
values ('https://push.example.test/one', 'key-one', 'auth-one');

select is(
  (select user_id from public.push_subscriptions),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'a new subscription belongs to the signed-in User by default'
);
select throws_ok(
  $$ insert into public.push_subscriptions (endpoint, p256dh, auth)
     values ('https://push.example.test/one', 'k', 'a') $$,
  '23505', null, 'a device is subscribed once'
);

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is((select count(*) from public.push_subscriptions), 0::bigint, 'another User sees no subscriptions');
update public.push_subscriptions set p256dh = 'stolen';
delete from public.push_subscriptions;
select throws_ok(
  $$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://push.example.test/planted', 'k', 'a') $$,
  '42501', null, 'a User cannot subscribe a device for someone else'
);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is(
  (select p256dh from public.push_subscriptions),
  'key-one',
  'another User could not change or delete the subscription'
);

reset role;
set local role anon;
select throws_ok($$ select * from public.push_subscriptions $$, '42501', null, 'anon cannot read subscriptions');
reset role;

-- ---------------------------------------------------------------------------------------------
-- Who can ask who is due.
-- ---------------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok(
  $$ select * from public.due_reminders(now()) $$,
  '42501', null, 'a signed-in User cannot list due Reminders'
);
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.due_reminders(now()) $$,
  '42501', null, 'anon cannot list due Reminders'
);
reset role;
set local role service_role;
select lives_ok(
  $$ select * from public.due_reminders(now()) $$,
  'the scheduler (service role) can list due Reminders'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- due_reminders. User one: Reminder at 19:00 in Sydney, one device. Days are in their zone.
-- ---------------------------------------------------------------------------------------------
update public.user_settings
set reminder_time = '19:00', reminder_enabled = true, time_zone = 'Australia/Sydney'
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- 2026-09-15 is winter time in Sydney (UTC+10): 19:00 there is 09:00 UTC.
select is(
  (select count(*) from public.due_reminders('2026-09-15 09:00:00+00')),
  1::bigint,
  'due at the chosen time'
);
select is(
  (select count(*) from public.due_reminders('2026-09-15 09:14:59+00')),
  1::bigint,
  'still due until the quarter hour ends'
);
select is(
  (select count(*) from public.due_reminders('2026-09-15 09:15:00+00')),
  0::bigint,
  'not due once the next quarter hour starts'
);
select is(
  (select count(*) from public.due_reminders('2026-09-15 08:45:00+00')),
  0::bigint,
  'not due before the chosen time'
);
select is(
  (select local_day from public.due_reminders('2026-09-15 09:00:00+00')),
  '2026-09-15'::date,
  'it names the User''s local Day'
);

-- Daylight saving began on Sunday 4 October 2026 (UTC+11 from then): 19:00 stays 19:00 local.
select is(
  (select count(*) from public.due_reminders('2026-10-03 09:00:00+00')),
  1::bigint,
  'due at 7:00 pm the evening before daylight saving starts'
);
select is(
  (select count(*) from public.due_reminders('2026-10-04 08:00:00+00')),
  1::bigint,
  'due at 7:00 pm local the evening daylight saving starts'
);
select is(
  (select count(*) from public.due_reminders('2026-10-04 09:00:00+00')),
  0::bigint,
  'and an hour later by the old offset is 8:00 pm, not due'
);

-- A UTC evening that is already tomorrow morning in Sydney is not this User's evening.
select is(
  (select count(*) from public.due_reminders('2026-09-15 19:00:00+00')),
  0::bigint,
  'the Reminder follows the User''s clock, not UTC'
);

-- Logging anything on the local Day silences it; another Day does not.
insert into public.entries (user_id, food_id, day, quantity)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-09-14', 1);
select is(
  (select count(*) from public.due_reminders('2026-09-15 09:00:00+00')),
  1::bigint,
  'an Entry on another Day does not silence it'
);
insert into public.entries (user_id, food_id, day, quantity)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-09-15', 1);
select is(
  (select count(*) from public.due_reminders('2026-09-15 09:00:00+00')),
  0::bigint,
  'an Entry on today silences it'
);
-- Planned Entries are Entries (ADR 0004): one planned for a Day counts when that Day is "today".
select is(
  (select count(*) from public.due_reminders('2026-09-16 09:00:00+00')),
  1::bigint,
  'a later Day with no Entries is due again'
);
insert into public.entries (user_id, food_id, day, quantity)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-09-16', 1);
select is(
  (select count(*) from public.due_reminders('2026-09-16 09:00:00+00')),
  0::bigint,
  'an Entry planned earlier for today silences it'
);
delete from public.entries;

-- At most one a Day, even after the time moves later.
update public.user_settings set reminder_last_sent_on = '2026-09-15'
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select count(*) from public.due_reminders('2026-09-15 09:00:00+00')),
  0::bigint,
  'not sent twice on the same Day'
);
update public.user_settings set reminder_time = '19:30'
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select count(*) from public.due_reminders('2026-09-15 09:30:00+00')),
  0::bigint,
  'moving the time later does not send a second one that Day'
);
select is(
  (select count(*) from public.due_reminders('2026-09-16 09:30:00+00')),
  1::bigint,
  'the next Day is due again'
);

-- Off means off.
update public.user_settings set reminder_enabled = false
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select count(*) from public.due_reminders('2026-09-16 09:30:00+00')),
  0::bigint,
  'a switched-off Reminder is never due'
);

select * from finish();
rollback;
