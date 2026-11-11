-- Where each Bug report's Issue has got to, and the sync that records it (spec 194, Slice 3).
-- Additive only: the new columns are nullable and the deployed app never selects them. The existing
-- select policy and table-level select grant already let a User read only their own rows.

alter table public.bug_reports
  add column outcome text
    check (outcome in ('sent', 'being_fixed', 'waiting_for_owner', 'fixed', 'not_going_ahead')),
  add column issue_title text check (char_length(issue_title) <= 256),
  add column latest_comment text check (char_length(latest_comment) <= 2000),
  add column outcome_changed_at timestamptz;

-- Records the outcomes the board's sync worked out from GitHub. A row is updated only when both its
-- id and its Bug Issue number match, so a stray Issue changes nothing. Returns only the rows whose
-- outcome just changed into Fixed or Not going ahead, so each is notified once even if the same sync
-- arrives twice. Only the server (service role) may call it.
create function public.apply_bug_report_sync(updates jsonb)
returns table (
  id uuid,
  user_id uuid,
  new_outcome text,
  issue_title text,
  latest_comment text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  previous text;
  s_id uuid;
  s_user uuid;
  s_outcome text;
  s_title text;
  s_comment text;
begin
  for item in select value from jsonb_array_elements(updates) loop
    -- One update decides it: the locked row before the update gives the previous outcome.
    update public.bug_reports r
    set outcome = item ->> 'outcome',
        issue_title = left(item ->> 'issue_title', 256),
        latest_comment = left(item ->> 'latest_comment', 2000),
        outcome_changed_at = case
          when prev.outcome is not distinct from item ->> 'outcome' then r.outcome_changed_at
          else now()
        end
    from (
      select b.id, b.outcome
      from public.bug_reports b
      where b.id = (item ->> 'id')::uuid
        and b.bug_issue = (item ->> 'bug_issue')::integer
      for update
    ) prev
    where r.id = prev.id
    returning r.id, r.user_id, r.outcome, r.issue_title, r.latest_comment, prev.outcome
    into s_id, s_user, s_outcome, s_title, s_comment, previous;

    if found
      and s_outcome in ('fixed', 'not_going_ahead')
      and s_outcome is distinct from previous
    then
      id := s_id;
      user_id := s_user;
      new_outcome := s_outcome;
      issue_title := s_title;
      latest_comment := s_comment;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_bug_report_sync(jsonb) from public, anon, authenticated;
grant execute on function public.apply_bug_report_sync(jsonb) to service_role;
