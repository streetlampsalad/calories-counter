# Workflow

How work moves from an idea to production ([ADR 0007](../adr/0007-spec-driven-pull-requests-gated-by-risk.md)). Product language lives in [`CONTEXT.md`](../../CONTEXT.md); this file holds the process language. Agents run it through the [`/deliver`](../../.claude/skills/deliver/SKILL.md) skill.

## Terms

- **Issue**: any GitHub issue on `streetlampsalad/calories-counter`. Every change has one before work starts.
- **Issue type**: one of Feature, Spec, Slice, Bug, Chore or Spike, each with its own issue template and label.
  - **Feature**: an idea for new or changed behaviour, not yet specified. Its template's headings (`### Problem`, `### Who has it`, `### Desired outcome`, `### Requested by`) are a contract, so an Issue created through the API reads the same.
  - **Spec**: the parent Issue for one spec-kit spec in `specs/<Spec issue number>-<name>/`. A sub-issue of the Feature it answers.
  - **Slice**: an Issue that exactly one pull request delivers. A Spec's Slices come from the user-story phases of its `tasks.md` and are its sub-issues.
  - **Bug**: wrong behaviour, with steps to reproduce. Fixed with a regression test; no spec.
  - **Chore**: dependencies, CI, docs or refactoring with no change in behaviour; no spec.
  - **Spike**: time-boxed research that answers a question; no production code.
- **Task**: one checkbox in a spec's `tasks.md`. A Task is never its own Issue.
- **Spec pull request**: the pull request that adds a spec's `spec.md`, `plan.md` and `tasks.md`, before any Slice exists. Merging it approves the spec.
- **Risk assessment**: the check of each risk condition (new integration, irreversible change, unprovable in CI, auth or RLS, guardrails, ADR conflict, Size L or XL) that decides whether work needs Human review. A spec holds it in `spec.md`; Slices, Bugs and Chores tick it in their template and pull request.
- **Human review**: a human approves before the work proceeds, marked by the `needs-human-review` label, which an agent may add but never remove. On an Issue it means an agent waits for a human decision; on a pull request it means the merge waits until the owner reviews it and removes the label.
- **Human step**: a manual action only the repo owner can take, such as setting a secret or changing a dashboard. Marked by the `human-step` label. Not the same as Human review.
- **Dispatcher**: the scheduled cloud agent that runs `/deliver next`: it claims the next unblocked Issue and delivers exactly one pull request for it ([dispatcher.md](dispatcher.md)).
- **Done**: the change is in production, not merely merged.

_Avoid_: ticket, work item (say Issue, or the Issue type); "needs approval" (say Human review).

## The flow

1. **Feature** → the Dispatcher triages it: accepted (a Spec Issue is created as its sub-issue), rejected (`wontfix`), or asked about (`needs-human-review`).
2. **Spec** → spec-kit spec, self-interview and Risk assessment, ending in a Spec pull request. It auto-merges unless it needs Human review.
3. **Slices** → created from `tasks.md` once the Spec pull request merges, as sub-issues of the Spec with native "blocked by" links, each labelled `ready-for-agent`.
4. **Slice, Bug, Chore** → test first, self-review, one pull request with `Refs #<issue>`, Auto-fix on. CI, the Claude review and the merge gate decide the merge.
5. **Deploy** → `deploy.yml` deploys after CI passes on `main`, then closes the delivered Issues. A Spec closes with its last Slice, and a Feature with its Spec. A failed deploy opens a P0 Bug with Human review.

Only one Spec is written at a time; Bugs and Chores run alongside it.

## Labels

| Label | Meaning | Set by |
|---|---|---|
| `feature`, `spec`, `slice`, `bug`, `chore`, `spike` | Issue type | the issue template, or `/deliver` |
| `needs-triage` | a Feature or Bug nobody has triaged | the issue template |
| `ready-for-agent` | fully specified and unblocked; the Dispatcher may claim it | the owner, or `/deliver` |
| `needs-human-review` | waits for the owner (see Human review) | agents and the merge gate; removed only by the owner |
| `human-step` | needs a manual action by the owner | agents |
| `needs-info`, `wontfix` | waiting on the reporter; will not be done | triage |
| `priority:P0`–`P2` | order of work; mirrored to the board's Priority | the owner, or triage |
| `size:XS`–`XL` | from the Risk assessment; mirrored to the board's Size | `/deliver` |

## The board

[The Kanban project](https://github.com/users/streetlampsalad/projects/1) is a projection: `.github/workflows/board.yml` recomputes each card from its Issue on every event and nightly. Nobody moves cards by hand, and agents never touch the board (cloud sessions cannot call GraphQL).

| Status | When |
|---|---|
| Backlog | open, not `ready-for-agent` (new, in triage, or waiting for a human) |
| Ready | `ready-for-agent`, nobody assigned |
| In progress | assigned, or a draft pull request refers to it; a parent once any sub-issue starts |
| In review | an open pull request refers to it, or its pull request merged and awaits the deploy |
| Done | closed: in production, or rejected |
