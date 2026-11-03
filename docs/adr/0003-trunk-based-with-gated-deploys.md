# Trunk-based development with locally gated pushes and CI-driven deploys

All work is committed directly to `main`; there are no feature branches or pull requests. The full validation suite runs in a git pre-push hook, so nothing reaches `main` without passing it locally, and CI re-runs the same suite on every push as a backstop. Vercel's Git auto-deploy is deliberately disabled: a GitHub Action deploys only after CI passes, applying Supabase migrations first and then deploying the app, so the app never ships ahead of its schema.

## Consequences

- The pre-push hook needs Docker running (for local Supabase) and takes minutes, not seconds. Skipping it (`--no-verify`) is forbidden for agents.
- Half-built features land on `main` and reach production; they must stay unreachable (no navigation or route) until their final issue lands. There is no feature-flag system.
- Migrations must be backwards compatible with the currently deployed app for the short window between `supabase db push` and the Vercel deploy.
