# Calories Counter

A mobile-first calorie tracker for a few friends: keep a Food List, log what you eat each Day in two taps, and see how you're tracking over time. Built with Next.js, TanStack Query and Supabase, deployed on Vercel (Sydney).

- What the words mean: [`CONTEXT.md`](CONTEXT.md)
- What we're building: [`specs/`](specs/) (spec-kit), and specs 001–019 in [`docs/specs/`](docs/specs/README.md)
- How work moves from an idea to production: [`docs/agents/workflow.md`](docs/agents/workflow.md)
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
pnpm validate         # everything, including database and e2e tests (CI runs it on every pull request)
```

Every change starts as an Issue and reaches `main` through a pull request. The pre-push hook runs `pnpm validate:fast`; CI runs the full gate, and pull requests auto-merge unless they need Human review ([ADR 0007](docs/adr/0007-spec-driven-pull-requests-gated-by-risk.md)).

## Deploying

Merges to `main` that pass CI deploy automatically: migrations first, then the app, then the delivered Issues close ([`deploy.yml`](.github/workflows/deploy.yml)). One-time production setup (tokens, Vercel project, secrets) is a guided script, run from Git Bash:

```bash
./scripts/setup-production.sh
```

The daily Reminder ([spec 016](docs/specs/016-daily-reminder.md)) needs a push key, a scheduler secret and two Supabase Vault secrets in production. A second guided script sets them up, after the first:

```bash
./scripts/setup-reminders.sh
```

The agentic workflow (automation token, Claude review token, ruleset on `main`, the Dispatcher routine) has its own guided script:

```bash
./scripts/setup-workflow.sh
```
