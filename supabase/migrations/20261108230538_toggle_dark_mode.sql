-- Dark mode (spec 147): Toggle feature-146. Additive only, and safe with the deployed app, which
-- does not know the key.

insert into public.toggles (key, title)
values ('feature-146', 'I want to be able to toggle the app into dark mode.')
on conflict do nothing;
