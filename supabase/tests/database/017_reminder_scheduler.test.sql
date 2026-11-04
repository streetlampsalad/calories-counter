-- The Reminder scheduler (spec 016, ADR 0005): a 15-minute job that asks the app to send, using an
-- address and secret kept in Vault, and that nobody signed in can trigger.
begin;
select plan(10);

select is(
  (select count(*) from cron.job where jobname = 'send-reminders' and schedule = '*/15 * * * *'),
  1::bigint,
  'a job runs every 15 minutes'
);
select is(
  (select command from cron.job where jobname = 'send-reminders'),
  'select public.send_due_reminders()',
  'and it calls send_due_reminders'
);

select ok(
  not has_function_privilege('anon', 'public.send_due_reminders()', 'execute'),
  'anon cannot trigger a send'
);
select ok(
  not has_function_privilege('authenticated', 'public.send_due_reminders()', 'execute'),
  'a signed-in User cannot trigger a send'
);

-- Without an address and secret in Vault (local, CI) it does nothing.
delete from net.http_request_queue;
select is(public.send_due_reminders(), false, 'with nothing in Vault it does not ask');
select is(
  (select count(*) from net.http_request_queue),
  0::bigint,
  'and sends no request'
);

-- An address alone is not enough.
select vault.create_secret('https://calories.example.test/api/reminders/send', 'reminder_url');
select is(public.send_due_reminders(), false, 'with an address but no secret it does not ask');

-- With both, it posts the secret in a header to the address.
select vault.create_secret('shared-secret-value', 'reminder_secret');
select is(public.send_due_reminders(), true, 'with both it asks');
select is(
  (select count(*) from net.http_request_queue
   where method = 'POST' and url = 'https://calories.example.test/api/reminders/send'),
  1::bigint,
  'one POST goes to the send route'
);
select is(
  (select headers ->> 'x-scheduler-secret' from net.http_request_queue),
  'shared-secret-value',
  'carrying the shared secret'
);

select * from finish();
rollback;
