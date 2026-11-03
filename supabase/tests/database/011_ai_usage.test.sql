-- ai_usage: a per-User, per-Day, per-kind count behind the photo reader's daily limit.
begin;
select plan(13);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'one@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'two@example.test');

-- Yesterday's use does not count towards today.
insert into public.ai_usage (user_id, day, kind, count)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (now() at time zone 'Australia/Sydney')::date - 1, 'photo', 3);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select ok(public.increment_ai_usage('photo', 3), 'the first use is allowed');
select ok(public.increment_ai_usage('photo', 3), 'and the second');
select ok(public.increment_ai_usage('photo', 3), 'and the third, which reaches the limit');
select ok(not public.increment_ai_usage('photo', 3), 'the fourth is refused');
select ok(not public.increment_ai_usage('photo', 3), 'and so is every one after');

select is(
  (select count from public.ai_usage where day = (now() at time zone 'Australia/Sydney')::date and kind = 'photo'),
  3,
  'a refused use is not counted, so the count stops at the limit'
);

select ok(public.increment_ai_usage('other', 1), 'another kind has its own count');
select ok(not public.increment_ai_usage('photo', 0), 'a limit of zero allows nothing');

-- Another User starts from nothing.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select ok(public.increment_ai_usage('photo', 3), 'another User has a count of their own');
select is(
  (select count(*) from public.ai_usage),
  1::bigint,
  'and cannot see anyone else''s'
);

-- A User cannot reset or inflate their own count.
select throws_ok(
  $$ update public.ai_usage set count = 0 $$,
  '42501', null, 'a User cannot change the count directly'
);
select throws_ok(
  $$ insert into public.ai_usage (day, kind, count) values (current_date, 'photo', 0) $$,
  '42501', null, 'or write one'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.increment_ai_usage('photo', 3) $$,
  '42501', null, 'anon cannot use it'
);
reset role;

select * from finish();
rollback;
