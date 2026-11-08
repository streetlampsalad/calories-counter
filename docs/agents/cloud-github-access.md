# What a cloud session can do on GitHub

The answer to Spike [#105](https://github.com/streetlampsalad/calories-counter/issues/105): can a Claude Code cloud session carry out every GitHub step `/deliver` needs, using only the REST recipes in [`.claude/skills/deliver/github.md`](../../.claude/skills/deliver/github.md) through the GitHub proxy? The Dispatcher depends on it; the fallback was a fine-grained `GH_TOKEN` in the cloud environment, which would change [ADR 0006](../adr/0006-cloud-agents-work-on-branches.md)'s "no secrets in the cloud" rule.

Checked on 2026-11-08 in a cloud session (`CLAUDE_CODE_REMOTE=true`, the Default environment, no secrets), against the live repository. The scratch Issues were [#107](https://github.com/streetlampsalad/calories-counter/issues/107) and [#108](https://github.com/streetlampsalad/calories-counter/issues/108).

## Answer

**Yes. Every step works through the proxy with no token, so ADR 0006 stands and the Dispatcher needs no `GH_TOKEN`.** One recipe was wrong: `--paginate` fails after the first page, so the recipes now page by hand. The bigger finding is who the proxy acts as (see [Identity](#identity-the-proxy-acts-as-the-owner)).

## Results

| # | Recipe | Result | Error or note |
|---|---|---|---|
| 1 | `GH_TOKEN` | Worked | The literal placeholder `proxy-injected`; the proxy adds the real credential. |
| 1 | `gh api user --jq .login` | Worked | `streetlampsalad`, the repo owner. |
| 1 | `gh issue list` | Failed, as expected | `HTTP 403: GitHub GraphQL is not available from Claude Code sessions; use the REST API (gh api repos/{owner}/{repo}/...)`. `gh pr list` fails with the same message; `gh project list` fails with `unknown owner type`, its GraphQL owner lookup. |
| 2 | Read an Issue (`GET issues/<n>`) | Worked | Includes `sub_issues_summary`, `issue_dependencies_summary` and `parent_issue_url`. |
| 2 | Read its comments | Worked | With `--paginate` only while there is a single page; see the next row. |
| 2 | List with `--paginate` | **Failed after page 1** | `gh: Numeric-ID repository paths (repositories/{id}/...) are not supported through this proxy. Use repos/{owner}/{repo}/... endpoints instead. (HTTP 403)`. GitHub's `Link: <https://api.github.com/repositories/1443821662/issues?...&page=2...>` header names the repository by id. `&page=2` on the `repos/...` URL works. **Recipe corrected.** |
| 2 | Read sub-issues (`GET issues/<n>/sub_issues`) | Worked | |
| 2 | Read blockers (`GET issues/<n>/dependencies/blocked_by`) | Worked | `[]` when there are none. |
| 2 | The `ready-for-agent` list | Worked | One page of up to 100 is enough today. |
| 3 | Create two Issues (`POST issues`, body from the Chore template headings, `labels[]=chore`) | Worked | Returns `number` and the database `id` the linking calls need. |
| 4 | Add a label, remove a label | Worked | `priority:P2` works as written, in both the body and the `DELETE .../labels/<name>` path. |
| 4 | Comment | Worked | Posted as `streetlampsalad`. |
| 4 | Assign and unassign yourself | Worked | "Yourself" is the owner's login. |
| 5 | Sub-issue (`POST issues/107/sub_issues`, `sub_issue_id=<id of 108>`) | Worked | |
| 5 | Blocked by (`POST issues/108/dependencies/blocked_by`, `issue_id=<id of 107>`) | Worked | A `GET issues/108` straight afterwards still showed `blocked_by: 0`; it read `1` a few seconds later. Harmless for the Dispatcher, which runs hourly. |
| 6 | Close as not planned (`PATCH`, `state_reason=not_planned`) | Worked | Deleting an Issue needs GraphQL, so scratch Issues can only be closed. |
| 7 | Push the branch | Worked | `git push -u origin claude/...`. |
| 7 | Open the pull request (`POST pulls`) | Worked | [#109](https://github.com/streetlampsalad/calories-counter/pull/109), opened ready for review, authored by `streetlampsalad`. |
| 7 | Label the pull request (`POST issues/<pr>/labels`) | Worked | Added `needs-human-review`. |
| 8 | Read check runs (`GET commits/<sha>/check-runs`) | Worked | Listed `validate`, `Merge gate`, `Claude review` and `sync` with their status. |
| — | Draft and ready (`POST pulls/<pr>/ccr/convert_to_draft`, then `.../ccr/ready_for_review`) | Worked | Not in the Spike's list; tried because `github.md` said marking a draft ready needs GraphQL. Returned `{"draft":true}`, then `{"draft":false}`. **Recipe corrected.** |
| — | Read review threads (`GET pulls/<pr>/ccr/review_threads`) | Worked | `[]` on a pull request with no review comments. |

## Identity: the proxy acts as the owner

Every write above was recorded on GitHub as `streetlampsalad`, the repo owner. The cloud session holds no token, but the proxy uses the owner's GitHub account, so to GitHub an agent and the owner are the same person. This matters for two guardrails:

- **The merge gate.** `scripts/workflow/merge-gate.mjs` re-adds `needs-human-review` when anyone but the owner removes it, by checking `payload.sender.login`. A removal made through the proxy has the owner as sender, so the merge gate would accept it as Human review.
- **`.claude/hooks/guard.mjs`.** It is the only thing that stops an agent removing that label or merging, and it has gaps. Its matcher is `Bash|PowerShell|Edit|Write|MultiEdit|NotebookEdit`, so it never sees the GitHub MCP tools that cloud sessions also have (`mcp__github__merge_pull_request`, and `mcp__github__issue_write`, which can replace an Issue's labels). Its merge rule misses the proxy's `PUT .../pulls/<n>/ccr/auto_merge` route. Its label rule needs the literal `needs-human-review` in the command, so it misses `--method=DELETE` and a `PUT .../labels` or `PATCH .../issues/<n>` that replaces the whole label set.

Neither was tried: both are among `/deliver`'s [limits](../../.claude/skills/deliver/SKILL.md#your-limits). A token would not fix this, because the gap is that the agent's GitHub identity is the owner's. Closing the gaps changes a guardrail, so it is a separate Chore with Human review: [#110](https://github.com/streetlampsalad/calories-counter/issues/110).

## Things the proxy offers beyond the REST API

The GraphQL refusal names routes the proxy adds on `api.github.com` for things REST cannot do:

- `GET repos/{owner}/{repo}/pulls/{n}/ccr/review_threads`, and `POST .../ccr/comments/{comment_id}/resolve` (or `/unresolve`)
- `POST repos/{owner}/{repo}/pulls/{n}/ccr/ready_for_review` and `.../ccr/convert_to_draft` (both tried, both work)
- `PUT` or `DELETE repos/{owner}/{repo}/pulls/{n}/ccr/auto_merge`; the merge gate owns auto-merge, so `/deliver` never calls it

## If a token were ever needed

None is. For the record, a fine-grained token limited to this repository covering these recipes would need **Issues: read and write**, **Pull requests: read and write**, **Contents: read and write** (to push), **Workflows: read and write** (only to push changes to `.github/workflows/`) and **Checks: read**, with **Metadata: read** added automatically. The board needs Projects access, but `board.yml` already does that with its own token.

## Not about GitHub, found on the way

This session's environment (Default) has no setup script, so `node_modules` was missing and lefthook's hooks were not installed: `git push` would have skipped `pnpm validate:fast`. Running `bash scripts/cloud-setup.sh` by hand fails with `Node 24 is required (found: 22) and nvm is not available.`, because the image keeps nvm in `/opt/nvm` rather than `~/.nvm`. With `NVM_DIR=/opt/nvm` it gets further, but `nvm install 24` cannot download Node. Putting the image's own `/opt/node24/bin` first on the `PATH` and running `corepack enable && pnpm install --frozen-lockfile` worked. Fixing the script and giving the Dispatcher's environment ([dispatcher.md](dispatcher.md)) a setup script is Chore [#111](https://github.com/streetlampsalad/calories-counter/issues/111).
