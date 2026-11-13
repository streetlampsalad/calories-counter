-- Nutrition tips (spec 219): Toggle feature-218. Additive only (a row), so the deployed app, which
-- ignores Toggles it does not know, is unaffected. increment_ai_usage takes any kind, so the new
-- 'tips' kind needs no change there.

insert into public.toggles (key, title)
values ('feature-218', 'Get Nutrition tips from what I''ve eaten each week.')
on conflict do nothing;
