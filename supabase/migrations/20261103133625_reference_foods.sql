-- Reference Foods (spec 007): Australian foods with energy per 100 g or 100 ml, used only as a
-- source of Suggestions. Shared by every User and read-only to them; loaded by migrations and seeds.

create extension if not exists pg_trgm with schema extensions;

create table public.reference_foods (
  id uuid primary key default gen_random_uuid(),
  source text not null check (char_length(source) between 1 and 40),
  source_id text not null check (char_length(source_id) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  energy_kj_per_100 numeric not null check (energy_kj_per_100 >= 0),
  calories_per_100 integer not null check (calories_per_100 between 0 and 9999),
  unit text not null check (unit in ('g', 'ml')),
  unique (source, source_id)
);

create index reference_foods_name_trgm
  on public.reference_foods using gin (name extensions.gin_trgm_ops);

alter table public.reference_foods enable row level security;

revoke all on public.reference_foods from anon, authenticated;
grant select on public.reference_foods to authenticated;

create policy "Signed-in Users read reference foods"
  on public.reference_foods for select to authenticated
  using (true);

-- Foods whose name matches the query, best first: a name that starts with it, then one with a word
-- that starts with it, then one that merely contains it, then near misses (typos). Case and
-- % or _ in the query are taken literally.
create function public.search_reference_foods(q text, max_results integer default 20)
returns table (
  id uuid,
  source text,
  source_id text,
  name text,
  energy_kj_per_100 numeric,
  calories_per_100 integer,
  unit text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      btrim(q) as term,
      regexp_replace(btrim(q), '([\\%_])', '\\\1', 'g') as like_term,
      regexp_replace(btrim(q), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') as regex_term
  )
  select f.id, f.source, f.source_id, f.name, f.energy_kj_per_100, f.calories_per_100, f.unit
  from public.reference_foods f
  cross join params p
  where char_length(p.term) >= 1
    and (
      f.name ilike '%' || p.like_term || '%'
      or extensions.word_similarity(p.term, f.name) >= 0.5
    )
  order by
    case
      when f.name ilike p.like_term || '%' then 0
      when f.name ~* ('(^|[^[:alnum:]])' || p.regex_term) then 1
      when f.name ilike '%' || p.like_term || '%' then 2
      else 3
    end,
    extensions.word_similarity(p.term, f.name) desc,
    char_length(f.name),
    f.name
  limit least(greatest(max_results, 1), 50);
$$;

revoke all on function public.search_reference_foods(text, integer) from public, anon;
grant execute on function public.search_reference_foods(text, integer) to authenticated;
