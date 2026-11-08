-- A reminder to decide (spec 135, Slice 4): one push notification per Round that has sat at Ready to
-- try for 14 days with its Toggle in Testing. A new nullable column and a new function, so the
-- deployed app is unaffected.

alter table public.feature_requests add column testing_reminder_sent_at timestamptz;

-- The Requesters due a reminder, each marked as reminded in the same update, so a sync that runs
-- twice reminds nobody twice. A Round reaching Ready to try again moves stage_changed_at past the
-- last reminder, so it can be reminded once more (D7). Only the server (service role) may call it.
create function public.due_testing_reminders()
returns table (request_id uuid, requester_id uuid, goal_text text)
language sql
security definer
set search_path = ''
as $$
  update public.feature_requests r
  set testing_reminder_sent_at = now()
  from public.toggles t
  where t.key = 'feature-' || r.feature_issue
    and t.state = 'testing'
    and r.stage = 'ready_to_try'
    and r.withdrawn_at is null
    and r.stage_changed_at <= now() - interval '14 days'
    and (r.testing_reminder_sent_at is null or r.testing_reminder_sent_at < r.stage_changed_at)
  returning r.id, r.user_id, r.goal;
$$;

revoke all on function public.due_testing_reminders() from public, anon, authenticated;
grant execute on function public.due_testing_reminders() to service_role;
