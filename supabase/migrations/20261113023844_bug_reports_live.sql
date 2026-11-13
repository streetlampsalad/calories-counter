-- Report a bug (Feature #192, spec 194) goes Live for everyone. It only moves forward, and only
-- from Testing (ADR 0008). The app deployed before this pull request still checks the Toggle, so
-- this turns Report a bug on for every User as soon as it runs, safe to ship before the app
-- (ADR 0003). The Toggle's row stays; only the checks in the app go.

update public.toggles
set state = 'live'
where key = 'feature-192'
  and state = 'testing';
