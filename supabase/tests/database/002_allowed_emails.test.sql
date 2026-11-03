-- Allowed Emails: unreachable through the API, and the sign-up hook enforces them (spec 002).
begin;
select plan(13);

-- Nobody can reach the list through the API.
set local role anon;
select throws_ok(
  $$ select * from public.allowed_emails $$,
  '42501', null, 'anon cannot read allowed_emails'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ select * from public.allowed_emails $$,
  '42501', null, 'authenticated cannot read allowed_emails'
);
select throws_ok(
  $$ insert into public.allowed_emails (email) values ('me@example.test') $$,
  '42501', null, 'authenticated cannot add themselves to allowed_emails'
);
-- The sign-up hook is for the auth service only.
select throws_ok(
  $$ select public.hook_before_user_created('{"user":{"email":"x@example.test"}}'::jsonb) $$,
  '42501', null, 'authenticated cannot call the sign-up hook'
);
reset role;

select ok(
  has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
  'the auth service can call the sign-up hook'
);

-- The hook.
insert into public.allowed_emails (email, note) values ('friend@example.test', 'test');

select is(
  public.hook_before_user_created('{"user":{"email":"friend@example.test"}}'::jsonb),
  '{}'::jsonb,
  'an allowed email may sign up'
);

select is(
  public.hook_before_user_created('{"user":{"email":"Friend@Example.TEST"}}'::jsonb),
  '{}'::jsonb,
  'matching ignores case'
);

select is(
  public.hook_before_user_created('{"user":{"email":"  friend@example.test "}}'::jsonb),
  '{}'::jsonb,
  'matching ignores surrounding spaces'
);

select is(
  public.hook_before_user_created('{"user":{"email":"stranger@gmail.com"}}'::jsonb)
    -> 'error' ->> 'message',
  'This app is invite-only. Ask the owner to add stranger@gmail.com.',
  'a stranger is told whom to ask and which email was refused'
);

select is(
  public.hook_before_user_created('{"user":{"email":"stranger@gmail.com"}}'::jsonb)
    -> 'error' ->> 'http_code',
  '403',
  'a stranger is refused with 403'
);

select is(
  public.hook_before_user_created('{"user":{}}'::jsonb) -> 'error' ->> 'message',
  'This app is invite-only. Ask the owner to add your Google email.',
  'a sign-up without an email is refused'
);

-- Stored emails are always lower case, so matching cannot silently miss.
select throws_ok(
  $$ insert into public.allowed_emails (email) values ('Shouty@Example.test') $$,
  '23514', null, 'emails must be stored in lower case'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'allowed_emails'),
  1::bigint,
  'allowed_emails has exactly one policy, which denies everything'
);

select * from finish();
rollback;
