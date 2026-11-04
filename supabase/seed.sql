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

-- gus is used only by tests of insights, whose results depend on a whole window of a User's
-- history. They run in series and reset his data first.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777',
  'authenticated', 'authenticated', 'gus@example.test',
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
where u.email = 'gus@example.test';

insert into public.allowed_emails (email, note) values ('gus@example.test', 'local test user (insights tests, run in series)');

-- ivy is used only by the test that uses up a day's photo reads, so no other test is ever refused.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', '88888888-8888-8888-8888-888888888888',
  'authenticated', 'authenticated', 'ivy@example.test',
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
where u.email = 'ivy@example.test';

insert into public.allowed_emails (email, note) values ('ivy@example.test', 'local test user (photo daily limit test)');

-- jo is used only by the Reminder tests (spec 016), which run in series and reset jo's settings and
-- push subscriptions first.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999',
  'authenticated', 'authenticated', 'jo@example.test',
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
where u.email = 'jo@example.test';

insert into public.allowed_emails (email, note) values ('jo@example.test', 'local test user (Reminder tests, run in series)');

-- A handful of reference foods so search can be developed and tested locally. These are rough
-- fixture values (source FIXTURE), not the real AFCD data, which is loaded by a data migration.
insert into public.reference_foods (source, source_id, name, energy_kj_per_100, calories_per_100, unit)
values
  ('FIXTURE', 'banana', 'Banana, cavendish, raw', 389, 93, 'g'),
  ('FIXTURE', 'bread', 'Bread, white, commercial', 1050, 251, 'g'),
  ('FIXTURE', 'egg', 'Egg, chicken, whole, raw', 626, 150, 'g'),
  ('FIXTURE', 'apple', 'Apple, red, raw', 220, 53, 'g'),
  ('FIXTURE', 'milk', 'Milk, cow, full fat', 270, 65, 'ml'),
  ('FIXTURE', 'rice', 'Rice, white, boiled', 585, 140, 'g'),
  ('FIXTURE', 'chicken', 'Chicken, breast, raw', 460, 110, 'g'),
  ('FIXTURE', 'vegemite', 'Vegemite', 710, 170, 'g');
