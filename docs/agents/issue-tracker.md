# Issue tracker: GitHub

Issues and specs for this repo live as GitHub Issues on `streetlampsalad/calories-counter`.

## Operations

Use the `gh api` REST recipes in [`.claude/skills/deliver/github.md`](../../.claude/skills/deliver/github.md) for every operation: reading, listing, creating, commenting, labelling, linking and closing. They work locally and in a cloud session, where the GitHub proxy blocks the GraphQL that `gh issue` and `gh pr` rely on ([cloud-github-access.md](cloud-github-access.md)).

## This repo's conventions

The process is [`workflow.md`](workflow.md). `/issue` writes an Issue and `/deliver` carries one out.

- Every change has an Issue first, created from one of the six templates (Feature, Spec, Slice, Bug, Chore, Spike); blank issues are off. The type is a label.
- A spec in `specs/<Spec issue>-<name>/` (or a frozen one in `docs/specs/`) is the source of truth; its acceptance criteria are the definition of done. Issues copy criteria from it, never the other way round.
- A Spec is a sub-issue of its Feature, and each Slice is a sub-issue of its Spec. Blocking uses GitHub's native "blocked by" dependencies.
- Pull requests say `Refs #<n>`, never a closing keyword: `deploy.yml` closes the Issue once the change is in production.
- `needs-human-review` means a human approves before the work proceeds; agents add it and never remove it. `human-step` marks a manual action by the repo owner. Agents leave both alone once set.
- The Kanban board is maintained by `.github/workflows/board.yml`. Never move cards by hand.

## When a skill says "publish to the issue tracker"

Create a GitHub Issue with the `/issue` skill, from the template for its type.

## When a skill says "fetch the relevant ticket"

Read the Issue and its comments with the Read recipes in `github.md`.

## Pull requests as a triage surface

**PRs as a request surface: no.** Requests arrive as Issues.
