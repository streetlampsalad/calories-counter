-- Meal times (spec 174): Toggle feature-173 and an optional Meal time on an Entry. Additive only
-- (a nullable column), so the deployed app's inserts and selects are unaffected.

insert into public.toggles (key, title)
values ('feature-173', 'Tag Entries with a Meal time.')
on conflict do nothing;

alter table public.entries
  add column meal_time text
  check (meal_time in ('breakfast', 'lunch', 'dinner', 'snack'));
