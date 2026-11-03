-- daily_totals: exact sums from the Foods' current calories, only for the caller, only logged Days.
begin;
select plan(13);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories)
values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rice', '100 g', 130),
  ('f1f1f1f1-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Odd', '1 piece', 55),
  ('f1f1f1f1-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Water', '250 ml', 0),
  ('f2f2f2f2-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pasta', '100 g', 160);

insert into public.entries (user_id, food_id, day, quantity)
values
  -- 2026-11-02: 1.5 x 110 + 2 x 130 = 165 + 260 = 425
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-02', 1.5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000002', '2026-11-02', 2),
  -- 2026-11-03: two half-portions of a 55 kcal Food are 55, not 28 + 28
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000003', '2026-11-03', 0.5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000003', '2026-11-03', 0.5),
  -- 2026-11-04: only water: a logged Day that totals zero
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000004', '2026-11-04', 3),
  -- outside the range
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-10-31', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-06', 1),
  -- someone else's
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f2f2f2f2-0000-0000-0000-000000000001', '2026-11-02', 1);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select calories from public.daily_totals('2026-11-01', '2026-11-05') where day = '2026-11-02'),
  425,
  'adds Quantity times calories across a Day''s Entries'
);
select is(
  (select entry_count from public.daily_totals('2026-11-01', '2026-11-05') where day = '2026-11-02'),
  2::bigint,
  'counts the Day''s Entries'
);
select is(
  (select calories from public.daily_totals('2026-11-01', '2026-11-05') where day = '2026-11-03'),
  55,
  'rounds the exact sum once, so half-portions do not drift'
);
select is(
  (select calories from public.daily_totals('2026-11-01', '2026-11-05') where day = '2026-11-04'),
  0,
  'a Day of zero-calorie Foods is still a logged Day, totalling zero'
);
select is(
  (select count(*) from public.daily_totals('2026-11-01', '2026-11-05')),
  3::bigint,
  'only logged Days within the range appear'
);
select is(
  (select count(*) from public.daily_totals('2026-11-01', '2026-11-05') where day in ('2026-10-31', '2026-11-06')),
  0::bigint,
  'Days outside the range are left out'
);
select is(
  (select array_agg(day order by day) from public.daily_totals('2026-11-01', '2026-11-05')),
  array['2026-11-02', '2026-11-03', '2026-11-04']::date[],
  'Days come back in order'
);
select is(
  (select count(*) from public.daily_totals('2026-11-02', '2026-11-02')),
  1::bigint,
  'the range includes both its first and last day'
);

-- ADR 0001: editing a Food changes every Day that uses it.
reset role;
update public.foods set calories = 200 where id = 'f1f1f1f1-0000-0000-0000-000000000001';
set local role authenticated;
select is(
  (select calories from public.daily_totals('2026-11-01', '2026-11-05') where day = '2026-11-02'),
  560,
  'uses the Food''s current calories: 1.5 x 200 + 2 x 130'
);

-- Archived Foods still count.
reset role;
update public.foods set archived_at = now() where id = 'f1f1f1f1-0000-0000-0000-000000000001';
set local role authenticated;
select is(
  (select calories from public.daily_totals('2026-11-01', '2026-11-05') where day = '2026-11-02'),
  560,
  'an Archived Food still counts towards its Days'
);

-- Only the caller's own Entries are summed.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is(
  (select calories from public.daily_totals('2026-11-01', '2026-11-05') where day = '2026-11-02'),
  160,
  'another User gets only their own total for the same Day'
);
select is(
  (select count(*) from public.daily_totals('2026-11-01', '2026-11-05')),
  1::bigint,
  'and sees none of the first User''s Days'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.daily_totals('2026-11-01', '2026-11-05') $$,
  '42501', null, 'anon cannot call it'
);
reset role;

select * from finish();
rollback;
