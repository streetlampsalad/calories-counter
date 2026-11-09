-- Settings in categories (spec 168): Toggle feature-167. Additive only, and safe with the deployed
-- app, which does not know the key.

insert into public.toggles (key, title)
values ('feature-167', 'Organise Settings into categories.')
on conflict do nothing;
