-- Local development and test data. Loaded by `pnpm db:reset` (never in production).
--
-- Google sign-in cannot be automated, so locally two Users sign in with a password.
-- Production has the email provider switched off (ADR 0002).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'ada@example.test',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'bea@example.test',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email in ('ada@example.test', 'bea@example.test');

insert into public.allowed_emails (email, note)
values
  ('ada@example.test', 'local test user'),
  ('bea@example.test', 'local test user');

-- cleo always has an empty Food List and Log: tests must never leave data behind for her.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
  'authenticated', 'authenticated', 'cleo@example.test',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email = 'cleo@example.test';

insert into public.allowed_emails (email, note) values ('cleo@example.test', 'local test user (always empty)');

-- dan is used only by tests that depend on a User's whole history (Recent, ordering by use),
-- which would be disturbed by anything else running at the same time. Those tests run in
-- series and reset his data first.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
  'authenticated', 'authenticated', 'dan@example.test',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email = 'dan@example.test';

insert into public.allowed_emails (email, note) values ('dan@example.test', 'local test user (history-dependent tests, run in series)');

-- eve is used only by tests that change a User's settings (Goal, week start), which every
-- screen reads. They run in series and reset her settings first.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555',
  'authenticated', 'authenticated', 'eve@example.test',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email = 'eve@example.test';

insert into public.allowed_emails (email, note) values ('eve@example.test', 'local test user (settings tests, run in series)');

-- fay is used only by tests of summaries, whose numbers depend on a whole window of a User's
-- history. They run in series and reset her data first.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', '66666666-6666-6666-6666-666666666666',
  'authenticated', 'authenticated', 'fay@example.test',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email = 'fay@example.test';

insert into public.allowed_emails (email, note) values ('fay@example.test', 'local test user (summary tests, run in series)');
