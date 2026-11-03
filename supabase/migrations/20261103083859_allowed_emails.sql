-- Only people the owner has added may sign up (spec 002, ADR 0002).
-- Run by the Supabase "Before User Created" auth hook, so strangers never get an account.

create table public.allowed_emails (
  email text primary key check (email = lower(btrim(email))),
  note text,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

-- The owner edits this table in the Supabase dashboard; the API never touches it.
create policy "allowed_emails is not reachable through the API"
  on public.allowed_emails
  for all
  using (false)
  with check (false);

revoke all on public.allowed_emails from anon, authenticated;

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if exists (select 1 from public.allowed_emails where email = candidate) then
    return '{}'::jsonb;
  end if;

  -- The wording is parsed by src/app/auth/callback/route.ts to show the refused email.
  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'This app is invite-only. Ask the owner to add '
        || coalesce(nullif(candidate, ''), 'your Google email') || '.'
    )
  );
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
