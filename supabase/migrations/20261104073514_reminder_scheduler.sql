-- Every 15 minutes the database asks the app to send whatever Reminders are due (spec 016,
-- ADR 0005). The app's address and the shared secret live in Vault, set by hand in each
-- environment (scripts/setup-reminders.sh), so this migration holds no secrets and a database
-- without them (local, CI) simply does nothing.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Posts to the send route. Returns whether it asked: false when Vault has no address or secret.
-- Security definer because it reads Vault; nobody but the scheduler may call it.
create function public.send_due_reminders()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text;
  scheduler_secret text;
begin
  select decrypted_secret into target
  from vault.decrypted_secrets where name = 'reminder_url';
  select decrypted_secret into scheduler_secret
  from vault.decrypted_secrets where name = 'reminder_secret';

  if coalesce(target, '') = '' or coalesce(scheduler_secret, '') = '' then
    return false;
  end if;

  perform net.http_post(
    url := target,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scheduler-secret', scheduler_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  return true;
end;
$$;

revoke all on function public.send_due_reminders() from public, anon, authenticated;

-- Naming the job makes this safe to run again: pg_cron replaces a job of the same name.
select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  'select public.send_due_reminders()'
);
