# GitHub REST recipes

Use `gh api` for everything: in a cloud session the GitHub proxy blocks GraphQL, which `gh issue`, `gh pr` and `gh project` rely on. These calls work locally and in the cloud. `R=streetlampsalad/calories-counter`.

Write long bodies to a file in your scratch space and pass `-F body=@<file>`. Labels containing `:` work as written.

Never pass `--paginate` in a cloud session: GitHub's `Link` header points the next page at `repositories/<id>/...`, which the proxy refuses (`Numeric-ID repository paths ... are not supported through this proxy`), so the call fails after the first page. Ask for `per_page=100` and, if a page comes back full, fetch `&page=2` and so on. Evidence: [`docs/agents/cloud-github-access.md`](../../../docs/agents/cloud-github-access.md).

## Who am I

```bash
gh api user --jq .login
```

In a cloud session this is the repo owner (`streetlampsalad`): the proxy acts with the owner's GitHub account, so GitHub records everything you do as the owner's. That is why removing `needs-human-review` and merging are your hard limits, not things GitHub stops.

## Read

```bash
gh api "repos/$R/issues/<n>"                                  # labels, assignees, body, sub_issues_summary, issue_dependencies_summary
gh api "repos/$R/issues/<n>/comments?per_page=100" --jq '.[] | {user: .user.login, body}'
gh api "repos/$R/issues/<n>/sub_issues" --jq '.[] | {number, state}'
gh api "repos/$R/issues/<n>/dependencies/blocked_by" --jq '.[] | {number, state}'
gh api "repos/$R/issues?state=open&labels=ready-for-agent&per_page=100" \
  --jq '.[] | select(.pull_request == null) | {number, title, labels: [.labels[].name], assignees: [.assignees[].login], blocked: .issue_dependencies_summary.blocked_by, created_at}'
```

## Claim and release

```bash
gh api -X POST "repos/$R/issues/<n>/assignees" -f 'assignees[]=<login>'
gh api -X DELETE "repos/$R/issues/<n>/assignees" -f 'assignees[]=<login>'
```

## Labels and comments

```bash
gh api -X POST "repos/$R/issues/<n>/labels" -f 'labels[]=needs-human-review'
gh api -X DELETE "repos/$R/issues/<n>/labels/needs-triage"
gh api -X POST "repos/$R/issues/<n>/comments" -F body=@comment.md
```

## Create, link and close Issues

```bash
gh api -X POST "repos/$R/issues" -f title='[124] Show meal groups' -F body=@slice.md \
  -f 'labels[]=slice' -f 'labels[]=ready-for-agent' --jq '{number, id}'

# Sub-issues and dependencies take the child's or blocker's database `id`, not its number.
gh api -X POST "repos/$R/issues/<parent>/sub_issues" -F sub_issue_id=<child id>
gh api -X POST "repos/$R/issues/<blocked>/dependencies/blocked_by" -F issue_id=<blocker id>

gh api -X PATCH "repos/$R/issues/<n>" -f state=closed -f state_reason=not_planned
```

## Pull requests

```bash
gh api -X POST "repos/$R/pulls" -f title='<title>' -f head=<branch> -f base=main -F body=@pr.md --jq '{number, html_url}'
gh api -X POST "repos/$R/issues/<pr>/labels" -f 'labels[]=needs-human-review'
gh api "repos/$R/commits/<sha>/check-runs" --jq '.check_runs[] | {name, status, conclusion}'
```

Open pull requests ready for review. Where you need a draft in a cloud session, use the proxy's own routes, which exist only there (locally, `gh pr ready` works):

```bash
gh api -X POST "repos/$R/pulls/<pr>/ccr/convert_to_draft"
gh api -X POST "repos/$R/pulls/<pr>/ccr/ready_for_review"
gh api "repos/$R/pulls/<pr>/ccr/review_threads"             # review threads, for answering review comments
```
