-- Nutrition tips (Feature #218, spec 219, Slice 2): the last set of tips each User got for a week,
-- so reopening Summary shows them without asking Gemini again. One set per User per week; Ask again
-- replaces it. A new table the deployed app never reads (ADR 0003).

create table public.nutrition_tips (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  tips jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start),
  -- CASE, because AND need not stop at the first false: jsonb_array_length errors on a non-array.
  constraint nutrition_tips_tips_check check (
    case
      when jsonb_typeof(tips) = 'array' then jsonb_array_length(tips) between 1 and 3
      else false
    end
  )
);

alter table public.nutrition_tips enable row level security;

revoke all on public.nutrition_tips from anon, authenticated;
grant select, insert, update, delete on public.nutrition_tips to authenticated;

create policy "Users read their own Nutrition tips"
  on public.nutrition_tips for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add their own Nutrition tips"
  on public.nutrition_tips for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users replace their own Nutrition tips"
  on public.nutrition_tips for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users remove their own Nutrition tips"
  on public.nutrition_tips for delete to authenticated
  using (user_id = (select auth.uid()));
