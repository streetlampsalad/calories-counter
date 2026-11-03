-- food_usage: counts and recency per Food, within a window, for the caller only.
begin;
select plan(8);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories)
values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rice', '100 g', 130),
  ('f1f1f1f1-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Never eaten', '1 piece', 50),
  ('f2f2f2f2-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pasta', '100 g', 160);

insert into public.entries (user_id, food_id, day, quantity, created_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-01', 1, '2026-11-01 08:00+11'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-02', 2, '2026-11-02 08:00+11'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1, '2026-11-03 08:00+11'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000002', '2026-10-20', 1, '2026-10-20 12:00+11'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000002', '2026-05-01', 1, '2026-05-01 12:00+10'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f2f2f2f2-0000-0000-0000-000000000001', '2026-11-03', 1, '2026-11-03 09:00+11');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select entry_count from public.food_usage('2026-08-01') where food_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  3::bigint,
  'counts every Entry for a Food within the window'
);
select is(
  (select entry_count from public.food_usage('2026-08-01') where food_id = 'f1f1f1f1-0000-0000-0000-000000000002'),
  1::bigint,
  'leaves out Entries before the window'
);
select is(
  (select count(*) from public.food_usage('2026-08-01') where food_id = 'f1f1f1f1-0000-0000-0000-000000000003'),
  0::bigint,
  'a Food never logged does not appear'
);
select is(
  (select last_logged_at from public.food_usage('2026-08-01') where food_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  '2026-11-03 08:00+11'::timestamptz,
  'reports when the Food was last logged'
);
select is(
  (select entry_count from public.food_usage('2026-11-03') where food_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  1::bigint,
  'the window includes its first day'
);
select is(
  (select count(*) from public.food_usage('2026-08-01')),
  2::bigint,
  'only the caller''s Foods are reported'
);

select is(
  (select count(*) from public.food_usage('2100-01-01')),
  0::bigint,
  'an empty window reports nothing'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.food_usage('2026-08-01') $$,
  '42501', null, 'anon cannot call it'
);
reset role;

select * from finish();
rollback;
