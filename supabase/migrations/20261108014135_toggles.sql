-- Toggles (spec 116, ADR 0008): every new feature ships behind one, off for everyone.
-- A Toggle is in Testing (on only for the Users allowed to try it, each choosing for themselves),
-- Live (on for everyone) or Removed (off for everyone). toggle_is_on() is the only place that
-- decides, so the browser and the server always agree. Everything here is additive.

-- The Owner, set by hand in each environment like the Allowed Emails themselves.
alter table public.allowed_emails
  add column is_owner boolean not null default false;

-- Whether the caller is the Owner. Security definer because allowed_emails is unreachable
-- through the API; it reveals only the caller's own mark.
create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
    where email = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
      and is_owner
  );
$$;

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

create table public.toggles (
  -- The Feature Issue the Toggle belongs to; follow-up rounds of the Feature reuse it.
  key text primary key check (key ~ '^feature-[0-9]+$'),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  state text not null default 'testing' check (state in ('testing', 'live', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger toggles_set_updated_at
  before update on public.toggles
  for each row execute function public.set_updated_at();

-- Testing moves to Live or Removed, and nothing moves back: a Removed feature's tables may
-- already be gone, and a Live one's Toggle checks may already be deleted.
create function public.toggles_state_moves_forward()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state <> old.state and not (old.state = 'testing' and new.state in ('live', 'removed')) then
    raise exception 'A Toggle cannot move from % to %', old.state, new.state
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger toggles_state_moves_forward
  before update of state on public.toggles
  for each row execute function public.toggles_state_moves_forward();

alter table public.toggles enable row level security;

-- Migrations add and move Toggles; through the API they are read-only.
revoke all on public.toggles from anon, authenticated;
grant select on public.toggles to authenticated;

-- Every User may see which Toggles exist: their titles are public on GitHub anyway.
create policy "Users read every Toggle"
  on public.toggles for select to authenticated
  using (true);

-- Who may try a Toggle in Testing. Only the Owner for now; Feature #114 adds the requester.
create function public.can_try_toggle(key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_owner();
$$;

-- Whether the caller may turn a Toggle on or off for themselves: it is in Testing and they may try it.
create function public.can_switch_toggle(key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.toggles t
    where t.key = can_switch_toggle.key and t.state = 'testing'
  ) and public.can_try_toggle(can_switch_toggle.key);
$$;

create table public.toggle_overrides (
  toggle_key text not null references public.toggles (key) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (toggle_key, user_id)
);

create index toggle_overrides_user_id_idx on public.toggle_overrides (user_id);

create trigger toggle_overrides_set_updated_at
  before update on public.toggle_overrides
  for each row execute function public.set_updated_at();

alter table public.toggle_overrides enable row level security;

revoke all on public.toggle_overrides from anon;

create policy "Users read their own overrides"
  on public.toggle_overrides for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add their own overrides to Toggles they may switch"
  on public.toggle_overrides for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_switch_toggle(toggle_key));

create policy "Users change their own overrides to Toggles they may switch"
  on public.toggle_overrides for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_switch_toggle(toggle_key));

create policy "Users delete their own overrides"
  on public.toggle_overrides for delete to authenticated
  using (user_id = (select auth.uid()));

-- Whether a Toggle is on for the caller. Off when no Toggle has the key, so code merged
-- before its migration shows nothing. An override counts only while the caller may still try it.
create function public.toggle_is_on(key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select case t.state
        when 'live' then true
        when 'removed' then false
        else public.can_try_toggle(t.key) and coalesce(
          (
            select o.enabled from public.toggle_overrides o
            where o.toggle_key = t.key and o.user_id = (select auth.uid())
          ),
          false
        )
      end
      from public.toggles t
      where t.key = toggle_is_on.key
    ),
    false
  );
$$;

-- Every Toggle with the caller's answer, for the browser to load in one request.
create function public.my_toggles()
returns table (key text, title text, state text, is_on boolean, can_switch boolean)
language sql
stable
set search_path = ''
as $$
  select t.key, t.title, t.state, public.toggle_is_on(t.key), public.can_switch_toggle(t.key)
  from public.toggles t
  order by t.created_at, t.key;
$$;

revoke all on function public.can_try_toggle(text) from public, anon;
revoke all on function public.can_switch_toggle(text) from public, anon;
revoke all on function public.toggle_is_on(text) from public, anon;
revoke all on function public.my_toggles() from public, anon;
grant execute on function public.can_try_toggle(text) to authenticated;
grant execute on function public.can_switch_toggle(text) to authenticated;
grant execute on function public.toggle_is_on(text) to authenticated;
grant execute on function public.my_toggles() to authenticated;

-- The trigger function is not part of the API.
revoke all on function public.toggles_state_moves_forward() from public, anon, authenticated;
