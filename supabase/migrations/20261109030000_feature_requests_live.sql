-- Feature Requests (Feature #114, specs 124 and 135) goes Live for everyone. It only moves
-- forward, and only from Testing (ADR 0008). The deployed app still checks the Toggle, so this
-- turns Feature Requests on for every User as soon as it runs, safe to ship before the app (ADR 0003).
-- The Toggle's row stays; only the checks in the app go.

update public.toggles
set state = 'live'
where key = 'feature-114'
  and state = 'testing';
