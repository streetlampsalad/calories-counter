# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

Locally the `gh issue` commands work. In a cloud session the GitHub proxy blocks GraphQL, so `gh issue` and `gh pr` fail; use the `gh api` REST recipes in [`.claude/skills/deliver/github.md`](../../.claude/skills/deliver/github.md), which work in both.

- **Create an issue**: `gh api -X POST repos/<owner>/<repo>/issues -f title=... -F body=@body.md -f 'labels[]=...'`. Start from the issue template for its type (`.github/ISSUE_TEMPLATE/`) and keep its headings.
- **Read an issue**: `gh api repos/<owner>/<repo>/issues/<n>` and `.../issues/<n>/comments`.
- **List issues**: `gh api "repos/<owner>/<repo>/issues?state=open&labels=<label>&per_page=100" --paginate`, dropping entries with a `pull_request` field.
- **Comment on an issue**: `gh api -X POST repos/<owner>/<repo>/issues/<n>/comments -F body=@comment.md`
- **Apply / remove labels**: `POST .../issues/<n>/labels -f 'labels[]=...'` / `DELETE .../issues/<n>/labels/<label>`
- **Close**: `gh api -X PATCH repos/<owner>/<repo>/issues/<n> -f state=closed -f state_reason=<completed|not_planned>`

## This repo's conventions

The process is [`workflow.md`](workflow.md); `/deliver` carries it out.

- Every change has an Issue first, created from one of the six templates (Feature, Spec, Slice, Bug, Chore, Spike); blank issues are off. The type is a label.
- A spec in `specs/<Spec issue>-<name>/` (or a frozen one in `docs/specs/`) is the source of truth; its acceptance criteria are the definition of done. Issues copy criteria from it, never the other way round.
- A Spec is a sub-issue of its Feature, and each Slice is a sub-issue of its Spec. Blocking uses GitHub's native "blocked by" dependencies.
- Pull requests say `Refs #<n>`, never a closing keyword: `deploy.yml` closes the Issue once the change is in production.
- `needs-human-review` means a human approves before the work proceeds; agents add it and never remove it. `human-step` marks a manual action by the repo owner. Agents leave both alone once set.
- The Kanban board is maintained by `.github/workflows/board.yml`. Never move cards by hand.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
