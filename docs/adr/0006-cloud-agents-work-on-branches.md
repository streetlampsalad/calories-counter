# Cloud agents work on branches, gated by CI

Claude Code cloud agents push to a `claude/*` branch and open a pull request into `main`; a human merges it. This is the one exception to [ADR 0003](0003-trunk-based-with-gated-deploys.md). We chose this because the cloud sandbox has no Docker, so the pre-push hook cannot run the full `pnpm validate` there, and cloud sessions cannot push to `main` anyway. CI now also runs on pull requests, so the full gate (database, build, e2e) still stands between a cloud agent's work and `main`.

## Consequences

- In the cloud (`CLAUDE_CODE_REMOTE=true`) `pnpm validate` runs only the fast checks, so the pre-push hook passes. CI is the real gate for that work.
- `deploy.yml` still deploys only after CI succeeds on a push to `main`, so a pull request never deploys.
- Humans and local agents keep committing straight to `main` as ADR 0003 says.
- A feature that spans several pull requests must still stay unreachable until its last issue lands.
- The cloud environment is configured in the Claude Code web UI, not in the repo: setup script `bash scripts/cloud-setup.sh`, and no secrets, because the fast checks need none.
