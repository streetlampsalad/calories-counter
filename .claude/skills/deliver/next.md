# Choosing the next Issue

The Dispatcher runs `/deliver next` hourly, after each merge, and when an Issue event gives it work ([dispatcher.md](../../../docs/agents/dispatcher.md)). Pick exactly one Issue.

## Candidates

An open Issue (not a pull request) with **no assignee** that is one of:

- labelled `ready-for-agent`, or
- a `feature` or `bug` labelled `needs-triage` opened by an **allowed author**, or
- a `spec` whose spec folder (`specs/<number>-*/tasks.md`) is on `main` and which has no sub-issues yet.

Labels need write access, so anything labelled `ready-for-agent` was labelled by the owner or by an agent working from an allowed Issue. **Allowed authors**: the repo owner (`streetlampsalad`). The in-app feature-request flow will add its own GitHub identity here.

Remove from the candidates every Issue that:

- carries `needs-human-review` or `human-step` (it waits for a human),
- has an open blocker (`issue_dependencies_summary.blocked_by > 0`), or
- is a `spec` without a spec folder while another `spec` is open and assigned (one Spec in progress at a time; Bugs and Chores still run alongside it).

## Order

1. Priority label: `priority:P0`, then `P1`, then `P2`, then none.
2. Within a priority: `bug`, then `slice` (oldest Spec first), then `spec`, then `feature`, then `chore`, then `spike`.
3. Oldest first.

Take the first. Done when you have one Issue number, or have confirmed there are no candidates (report the count you filtered and why, then stop).
