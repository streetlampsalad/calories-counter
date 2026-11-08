# Spec-driven pull requests, auto-merged unless the risk needs a human

Supersedes [ADR 0003](0003-trunk-based-with-gated-deploys.md) and [ADR 0006](0006-cloud-agents-work-on-branches.md).

Every change starts as a GitHub Issue and reaches `main` only through a pull request, for humans and agents alike. A Feature becomes a spec-kit spec in `specs/<Spec issue>-<name>/`, and merging its Spec pull request approves it. Each Slice, Bug or Chore is one pull request that must pass CI, a Claude review and a merge gate; the merge gate then auto-merges it unless it needs Human review. Need for Human review is decided twice: by the agent's Risk assessment, and by deterministic rules on the diff (guardrail files, dependencies, destructive or RLS migrations, new environment variables) that nothing written in an Issue or pull request can talk past. An Issue is Done when `deploy.yml` has its change in production, not when it merges.

We chose this so a cloud agent can take a small Feature from request to production with no human, while anything irreversible, security-sensitive or hard to prove still waits for one. Trunk-based commits to `main` could not carry a review step or a merge gate, and cloud agents need a gate that does not depend on Docker in their sandbox.

## Consequences

- A ruleset on `main` (`.github/rulesets/main.json`) requires a pull request, the `validate`, `Claude review` and `Merge gate` checks, and squash merges. Nobody can bypass it, because cloud agents act with the owner's identity; in an emergency the owner disables it in the repository settings. The pre-push hook runs `pnpm validate:fast`; CI runs the full `pnpm validate`.
- The merge gate and board workflows run on `pull_request_target` from `main`'s code, so a pull request cannot change the rules that judge it. Changing those rules is itself a guardrail change that needs Human review.
- Workflow writes use `AUTOMATION_TOKEN`, a classic token with the `repo` and `project` scopes, because events caused by the default `GITHUB_TOKEN` do not trigger other workflows (an auto-merge with it would never deploy). The Claude review runs on the owner's subscription through `CLAUDE_CODE_OAUTH_TOKEN`.
- Cloud agents act through GitHub's proxy with the owner's identity, so GitHub cannot tell an agent removing `needs-human-review` from the owner doing it. The guard hook blocks it in every Claude session; the merge gate puts the label back when anyone else removes it.
- Agents never touch the Kanban board. Cloud sessions cannot call GraphQL, so the board is a projection of labels, assignees and pull requests that `board.yml` recomputes on every event and nightly.
- Kept from ADR 0003: migrations ship minutes before the app and must work with the deployed version; a feature stays unreachable until its last Slice lands, since there are no feature flags (superseded by [ADR 0008](0008-every-new-feature-ships-behind-a-toggle.md): every new feature ships behind a Toggle); Vercel's Git auto-deploy stays off and `deploy.yml` deploys only after CI passes on `main`.
- Kept from ADR 0006: cloud sessions have no Docker, so `pnpm validate` runs only the fast checks there, and the cloud environment holds no secrets.
- Specs 001–019 stay in `docs/specs/` in their old format. New specs use spec-kit.
