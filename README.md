# Calories Counter

A mobile-first calorie tracker for a few friends: keep a Food List, log what you eat each Day in two taps, and see how you're tracking over time. Built with Next.js, TanStack Query and Supabase, deployed on Vercel (Sydney).

- What the words mean: [`CONTEXT.md`](CONTEXT.md)
- What we're building: [`docs/specs/`](docs/specs/README.md)
- Why it's built this way: [`docs/adr/`](docs/adr/)
- How agents (and humans) work here: [`AGENTS.md`](AGENTS.md)

## Getting started

Requires Node 24, pnpm and Docker Desktop.

```bash
pnpm install          # also installs the git hooks (lefthook)
pnpm db:start         # local Supabase in Docker
pnpm env:local        # writes .env.local for the local stack
pnpm dev              # http://127.0.0.1:3000
```

## Checks

```bash
pnpm validate:fast    # lint, typecheck, unit tests
pnpm validate         # everything, including database and e2e tests (runs on git push)
```

Development is trunk-based: commit to `main`, and the pre-push hook runs `pnpm validate`. CI re-runs it on every push and gates deploys ([ADR 0003](docs/adr/0003-trunk-based-with-gated-deploys.md)).

## Deploying

Pushes to `main` that pass CI deploy automatically: migrations first, then the app ([`deploy.yml`](.github/workflows/deploy.yml)). One-time production setup (tokens, Vercel project, secrets) is a guided script, run from Git Bash:

```bash
./scripts/setup-production.sh
```
