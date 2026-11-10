# Slice or Chore

Code changes. Follow `AGENTS.md` for where tests go and how the database changes.

## Before you write code

- **Slice**: read its spec folder (`spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/`). Your scope is the Slice's scenarios and task IDs; the definition of done is every scenario it covers.
- **Chore**: confirm no User-visible behaviour changes. If any does, it is a Feature or a Bug: comment, add `needs-human-review`, and stop.
- **Chore that removes a Toggle** (ADR 0008): for a Feature that is Live, delete the Toggle checks, the "off" branches and the "off" tests, and keep the "on" path with its tests; for a Feature that is Removed, delete the feature's code and tests. Either way keep the `feature-<n>` row in `public.toggles`, which the Feature Request's card reads, and leave the schema to a later migration.
- **Risk assessment**: tick the conditions in the Issue's checklist that apply. A tick means the pull request gets `needs-human-review`.

## Who builds it

The thinking stays in this session, on the model the Dispatcher runs on. Hand the build to the `implementer` subagent (`.claude/agents/implementer.md`), which runs on a faster model, when the work is decided and only needs building: a Slice, or a **mechanical Chore**, one whose Issue spells out the change (removing a Toggle, an upgrade, a refactor it describes). Build it yourself when it is mostly judgement: a Chore that changes the workflow, the guardrails or the agent instructions, or one whose Issue leaves the design open. Triage, specs, Spikes and Bugs never reach the `implementer`.

The subagent starts with none of this conversation, so its brief carries all of it:

- the Issue number and title, and the branch;
- for a Slice: the spec folder, the scenarios in scope copied verbatim, the task IDs, the Toggle key (`feature-<Feature issue number>`) and whether this Slice adds it;
- for a Chore: the Issue's What and Why, and for a Toggle removal, the Toggle key and whether the Feature is Live or Removed;
- every decision you have already made;
- the commit attribution lines.

When it reports back:

1. Settle every point under **Open**: correct the spec in this pull request (and say so in its description), or decide and record why.
2. Check each scenario in scope has its test, and run `pnpm validate:fast` yourself (`pnpm validate` where Docker exists).
3. Finish anything left, in this session.

When the Agent tool rejects `subagent_type: implementer` (a session that did not load `.claude/agents/`), build it yourself, test first as below, and say so in the pull request.

## Build it test first

Work red-green-refactor (the `/tdd` skill where it is installed): for each criterion, write the test, see it fail for the right reason, make it pass, and commit in small steps. Iterate with `pnpm validate:fast`. Mark each finished task `[x]` in `tasks.md` as you go.

- **Slice**: gate every new behaviour on the Feature's Toggle (ADR 0008): `useToggle("feature-<n>")` from `src/features/toggles/queries.ts` in the browser, `isToggleOn("feature-<n>")` from `src/features/toggles/server.ts` on the server, and new routes and route handlers answer 404 (`notFound()`) while it is off. The Feature's first Slice adds the Toggle in its migration: `insert into public.toggles (key, title) values ('feature-<n>', '<Feature title>')`. With the Toggle off, the app must behave exactly as before, and migrations stay additive.
- Migrations: `pnpm db:new <name>`, then `pnpm db:reset && pnpm db:types` where Docker exists. In the cloud, write the migration and its pgTAP tests anyway; CI runs them.
- When the code shows the spec is wrong, stop and fix the spec in this pull request (and say so in its description) rather than drifting from it silently.

Done when every criterion has a test that fails without the change, `pnpm validate` passes (the fast checks in the cloud), and every task for this Slice is ticked. Then hand over ([SKILL.md](SKILL.md) step 4).
