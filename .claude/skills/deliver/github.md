# GitHub REST recipes

Use `gh api` for everything: in a cloud session the GitHub proxy blocks GraphQL, which `gh issue`, `gh pr` and `gh project` rely on. These calls work locally and in the cloud. `R=streetlampsalad/calories-counter`.

Write long bodies to a file in your scratch space and pass `-F body=@<file>`. Labels containing `:` work as written.

## Who am I

```bash
gh api user --jq .login
```

## Read

```bash
gh api "repos/$R/issues/<n>"                                  # labels, assignees, body, sub_issues_summary, issue_dependencies_summary
gh api "repos/$R/issues/<n>/comments" --paginate --jq '.[] | {user: .user.login, body}'
gh api "repos/$R/issues/<n>/sub_issues" --jq '.[] | {number, state}'
gh api "repos/$R/issues/<n>/dependencies/blocked_by" --jq '.[] | {number, state}'
gh api "repos/$R/issues?state=open&labels=ready-for-agent&per_page=100" --paginate \
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

Open pull requests ready for review, never as drafts: marking a draft ready needs GraphQL.
