-- food_totals: each Food's calories over a range, from current calories, only for the caller.
begin;
select plan(11);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories, archived_at)
values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110, null),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rice', '100 g', 130, null),
  ('f1f1f1f1-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pie', '1 slice', 300, now()),
  ('f1f1f1f1-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Odd', '1 piece', 55, null),
  ('f2f2f2f2-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pasta', '100 g', 160, null);

insert into public.entries (user_id, food_id, day, quantity)
values
  -- Toast: 3 Entries, 2 + 1 + 1.5 = 4.5 portions x 110 = 495
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-01', 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-02', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-11-03', 1.5),
  -- Rice: 1 Entry, 2 x 130 = 260
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000002', '2026-11-02', 2),
  -- Pie (Archived): 1 Entry, 1 x 300
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000003', '2026-11-02', 1),
  -- Odd: 0.5 + 0.5 of a 55 kcal Food is 55, not 28 + 28
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000004', '2026-11-03', 0.5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000004', '2026-11-03', 0.5),
  -- outside the range
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1f1f1f1-0000-0000-0000-000000000001', '2026-10-01', 9),
  -- someone else's
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f2f2f2f2-0000-0000-0000-000000000001', '2026-11-02', 1);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select calories from public.food_totals('2026-11-01', '2026-11-30') where name = 'Toast'),
  495,
  'sums Quantity times the Food''s current calories across its Entries'
);
select is(
  (select entry_count from public.food_totals('2026-11-01', '2026-11-30') where name = 'Toast'),
  3::bigint,
  'counts how many times the Food was logged'
);
select is(
  (select calories from public.food_totals('2026-11-01', '2026-11-30') where name = 'Odd'),
  55,
  'rounds the exact sum once, so half-portions do not drift'
);
select is(
  (select array_agg(name order by calories desc, name) from public.food_totals('2026-11-01', '2026-11-30')),
  array['Toast', 'Pie', 'Rice', 'Odd'],
  'comes back biggest first'
);
select is(
  (select array_agg(name) from public.food_totals('2026-11-01', '2026-11-30')),
  array['Toast', 'Pie', 'Rice', 'Odd'],
  'already ordered, so the client can just take the top'
);
select ok(
  (select archived from public.food_totals('2026-11-01', '2026-11-30') where name = 'Pie'),
  'an Archived Food is included, and flagged'
);
select ok(
  not (select archived from public.food_totals('2026-11-01', '2026-11-30') where name = 'Toast'),
  'a live Food is not flagged'
);
select is(
  (select count(*) from public.food_totals('2026-11-01', '2026-11-30') where name = 'Toast' and calories <> 495),
  0::bigint,
  'Entries outside the range are left out'
);

reset role;
update public.foods set calories = 200 where id = 'f1f1f1f1-0000-0000-0000-000000000001';
set local role authenticated;
select is(
  (select calories from public.food_totals('2026-11-01', '2026-11-30') where name = 'Toast'),
  900,
  'follows an edit to the Food''s calories (ADR 0001): 4.5 x 200'
);

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is(
  (select array_agg(name) from public.food_totals('2026-11-01', '2026-11-30')),
  array['Pasta'],
  'another User sees only their own Foods'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.food_totals('2026-11-01', '2026-11-30') $$,
  '42501', null, 'anon cannot call it'
);
reset role;

select * from finish();
rollback;
