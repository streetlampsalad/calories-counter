# Slice, Bug or Chore

Code changes. Follow `AGENTS.md` for where tests go and how the database changes.

## Before you write code

- **Slice**: read its spec folder (`spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/`). Your scope is the Slice's scenarios and task IDs; the definition of done is every scenario it covers.
- **Bug**: remove `needs-triage`, then reproduce it. If it does not reproduce, comment with what you tried, add `needs-info`, unassign yourself, and stop. The definition of done is a regression test that goes red on the bug, then green with the fix.
- **Chore**: confirm no User-visible behaviour changes. If any does, it is a Feature or a Bug: comment, add `needs-human-review`, and stop.
- **Risk assessment**: tick the conditions in the Issue's checklist that apply. A tick means the pull request gets `needs-human-review`.

## Build it test first

Work red-green-refactor (the `/tdd` skill where it is installed): for each criterion, write the test, see it fail for the right reason, make it pass, and commit in small steps. Iterate with `pnpm validate:fast`. Mark each finished task `[x]` in `tasks.md` as you go.

- **Slice**: gate every new behaviour on the Feature's Toggle (ADR 0008): `useToggle("feature-<n>")` from `src/features/toggles/queries.ts` in the browser, `isToggleOn("feature-<n>")` from `src/features/toggles/server.ts` on the server, and new routes and route handlers answer 404 (`notFound()`) while it is off. The Feature's first Slice adds the Toggle in its migration: `insert into public.toggles (key, title) values ('feature-<n>', '<Feature title>')`. With the Toggle off, the app must behave exactly as before, and migrations stay additive.
- Migrations: `pnpm db:new <name>`, then `pnpm db:reset && pnpm db:types` where Docker exists. In the cloud, write the migration and its pgTAP tests anyway; CI runs them.
- When the code shows the spec is wrong, stop and fix the spec in this pull request (and say so in its description) rather than drifting from it silently.

Done when every criterion has a test that fails without the change, `pnpm validate` passes (the fast checks in the cloud), and every task for this Slice is ticked. Then hand over ([SKILL.md](SKILL.md) step 4).
