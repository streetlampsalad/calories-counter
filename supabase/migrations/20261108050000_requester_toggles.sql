-- The Requester's switch (spec 124, Slice 3, D11). A Requester may try their own feature's Toggle once
-- their request is Ready to try, until they withdraw it; the Owner still may try any Toggle. For every
-- User without such a request the answer is the same as before, so the deployed app is unaffected.
create or replace function public.can_try_toggle(key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_owner() or exists (
    select 1 from public.feature_requests r
    where 'feature-' || r.feature_issue = can_try_toggle.key
      and r.user_id = (select auth.uid())
      and r.stage = 'ready_to_try'
      and r.withdrawn_at is null
  );
$$;
