-- import_foods: add and update many Foods at once, all or nothing, only for the caller.
begin;
select plan(15);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

insert into public.foods (id, user_id, name, portion, calories, archived_at)
values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toast', '1 slice', 110, null),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Old pie', '1 slice', 300, now()),
  ('f2f2f2f2-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pasta', '100 g', 160, null);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

-- Adds and updates in one call, and says how many of each.
select results_eq(
  $$ select added, updated from public.import_foods('[
       {"name":"Banana","portion":"1 medium","calories":105},
       {"name":"Rice","portion":"100 g","calories":130},
       {"id":"f1f1f1f1-0000-0000-0000-000000000001","name":"Toast","portion":"1 slice","calories":120}
     ]'::jsonb) $$,
  $$ values (2, 1) $$,
  'returns how many Foods were added and updated'
);
select is(
  (select count(*) from public.foods where name in ('Banana', 'Rice')),
  2::bigint,
  'the new Foods are in the list'
);
select is(
  (select calories from public.foods where id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  120,
  'the chosen existing Food has its calories updated'
);
select is(
  (select name || '|' || portion from public.foods where id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  'Toast|1 slice',
  'an update leaves the name and portion as they were'
);
select is(
  (select user_id from public.foods where name = 'Banana'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'new Foods belong to the caller'
);

-- A bad row anywhere means nothing at all is saved.
select throws_ok(
  $$ select * from public.import_foods('[
       {"name":"Apple","portion":"1 medium","calories":80},
       {"name":"Impossible","portion":"1 serve","calories":99999}
     ]'::jsonb) $$,
  '23514', null,
  'a row that breaks a rule fails the whole import'
);
select is(
  (select count(*) from public.foods where name = 'Apple'),
  0::bigint,
  'and the valid rows before it are not saved'
);

select throws_ok(
  $$ select * from public.import_foods('[
       {"name":"Fresh","portion":"1 serve","calories":50},
       {"name":"banana","portion":"1 MEDIUM","calories":99}
     ]'::jsonb) $$,
  '23505', null,
  'a name and portion already in the list fails the whole import'
);
select is(
  (select count(*) from public.foods where name = 'Fresh'),
  0::bigint,
  'and nothing before it is saved'
);

select throws_ok(
  $$ select * from public.import_foods('[
       {"id":"f1f1f1f1-0000-0000-0000-000000000002","name":"Old pie","portion":"1 slice","calories":999}
     ]'::jsonb) $$,
  'P0002', null,
  'an Archived Food cannot be updated'
);

-- Only the caller's own Foods can be updated.
select throws_ok(
  $$ select * from public.import_foods('[
       {"id":"f2f2f2f2-0000-0000-0000-000000000001","name":"Pasta","portion":"100 g","calories":1}
     ]'::jsonb) $$,
  'P0002', null,
  'another User''s Food cannot be updated'
);
reset role;
select is(
  (select calories from public.foods where id = 'f2f2f2f2-0000-0000-0000-000000000001'),
  160,
  'and it is unchanged'
);
set local role authenticated;

select throws_ok(
  $$ select * from public.import_foods('{"name":"x"}'::jsonb) $$,
  '22023', null,
  'must be a list of rows'
);
select throws_ok(
  format($$ select * from public.import_foods(%L::jsonb) $$,
    (select jsonb_agg(jsonb_build_object('name', 'F' || n, 'portion', '1 serve', 'calories', 1))::text
       from generate_series(1, 201) n)),
  '54000', null,
  'more than 200 rows is refused'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.import_foods('[]'::jsonb) $$,
  '42501', null, 'anon cannot call it'
);
reset role;

select * from finish();
rollback;
