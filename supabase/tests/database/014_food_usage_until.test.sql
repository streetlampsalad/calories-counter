-- food_usage(since, until): the same counts as food_usage(since), but only for Days up to `until`,
-- so Planned Entries (spec 013) never reorder the picker or fill its Recent row.
begin;
select plan(7);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories)
values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Planned only', '1 serve', 200),
  ('f2f2f2f2-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pasta', '100 g', 160);

insert into public.entries (user_id, food_id, day, quantity, created_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-02', 1, '2026-11-02 08:00+11'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1, '2026-11-03 08:00+11'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-04', 1, '2026-11-03 09:00+11'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000002', '2026-11-05', 1, '2026-11-03 09:30+11'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f2f2f2f2-0000-0000-0000-000000000001', '2026-11-03', 1, '2026-11-03 09:00+11');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select entry_count from public.food_usage('2026-08-01', '2026-11-03') where food_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  2::bigint,
  'leaves out Entries after the last Day'
);
select is(
  (select last_logged_at from public.food_usage('2026-08-01', '2026-11-03') where food_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  '2026-11-03 08:00+11'::timestamptz,
  'a planned Entry does not make the Food look recently logged'
);
select is(
  (select count(*) from public.food_usage('2026-08-01', '2026-11-03') where food_id = 'f1f1f1f1-0000-0000-0000-000000000002'),
  0::bigint,
  'a Food that has only been planned does not appear'
);
select is(
  (select entry_count from public.food_usage('2026-11-03', '2026-11-03') where food_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  1::bigint,
  'the window includes both its first and last Day'
);
select is(
  (select count(*) from public.food_usage('2026-08-01', '2026-11-03')),
  1::bigint,
  'only the caller''s Foods are reported'
);
select is(
  (select entry_count from public.food_usage('2026-08-01') where food_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  3::bigint,
  'the one-argument version still counts every Entry, for the app that is already deployed'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.food_usage('2026-08-01', '2026-11-03') $$,
  '42501', null, 'anon cannot call it'
);
reset role;

select * from finish();
rollback;
