# 001: Environments and deploy pipeline

- **Status**: Ready
- **Depends on**: — (the repository scaffold is already in place)
- **Tracking issue**: [#1](https://github.com/streetlampsalad/calories-counter/issues/1)
- **ADRs**: 0003

## Goal

Every push to `main` that passes CI reaches production automatically, with database migrations applied before the app that needs them. After this spec there is one production environment (Vercel `syd1` + Supabase `ap-southeast-2`) and one local environment (Docker), and nothing else.

## User stories

- As the developer, I want a green push to `main` to deploy itself, so I never deploy by hand.
- As the developer, I want a failed CI run to stop the deploy, so a broken build or migration never reaches my friends.

## Acceptance criteria

- **AC-1**: Given a push to `main`, when CI passes, then the deploy workflow applies pending migrations to the Sydney Supabase project and then deploys the app to Vercel production, in that order.
- **AC-2**: Given a push to `main`, when CI fails, then the deploy workflow does not run.
- **AC-3**: Given a migration fails to apply, then the app is not deployed and the workflow fails visibly.
- **AC-4**: `GET /api/health` returns `200` with `{ "status": "ok", "commit": "<git sha>" }`, and the deploy workflow fails if production does not return the commit it just deployed within 2 minutes.
- **AC-5**: Vercel builds only from the deploy workflow. Its Git integration creates no deployments, including preview deployments.
- **AC-6**: Vercel serverless functions run in `syd1`.
- **AC-7**: Production environment variables are documented in `.env.example`, and the app fails fast at startup with a message naming any that are missing (already true for the public Supabase values in `src/lib/env.ts`).

## Out of scope

- A staging environment or preview deployments.
- A custom domain. The `*.vercel.app` URL is fine for now.
- Supabase Auth provider settings. Those belong to spec 002.

## Design

**Vercel**
- `vercel.json`: `{ "regions": ["syd1"], "git": { "deploymentEnabled": false } }`.
- Deploys use `vercel pull --environment=production`, `vercel build --prod`, then `vercel deploy --prebuilt --prod`.

**Supabase**
- Project ref `xrfbpeiugmacbossropu` (`calories-counter`, `ap-southeast-2`).
- The workflow runs `supabase link --project-ref $SUPABASE_PROJECT_REF`, then `supabase db push`. Only CI may do this; `.claude/hooks/guard.mjs` blocks agents from running it.

**`.github/workflows/deploy.yml`**
- Triggered by `workflow_run` of `CI` with `conclusion == success` on `main`.
- One job, with `concurrency: deploy-production` so deploys never overlap.
- Steps: migrate, then build and deploy, then the health check (AC-4).

**Secrets** (GitHub Actions)

| Secret | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Lets the CLI link the project and push migrations. |
| `SUPABASE_DB_PASSWORD` | Database password for `db push`. |
| `SUPABASE_PROJECT_REF` | `xrfbpeiugmacbossropu` |
| `VERCEL_TOKEN` | Vercel CLI authentication. |
| `VERCEL_ORG_ID` | Vercel team or account the project belongs to. |
| `VERCEL_PROJECT_ID` | The Vercel project. |

**Vercel environment variables** (production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and later `GEMINI_API_KEY` (specs 006 and 007).

**Health route**: `src/app/api/health/route.ts` returns `VERCEL_GIT_COMMIT_SHA`. The deploy passes the SHA with `--build-env` and `--env`, because a prebuilt deploy has no Git metadata.

Steps that need a human (creating the Vercel project, creating tokens, setting secrets) should be packaged as an interactive wizard script (`scripts/setup-production.sh`), using the `mattpocock-skills:wizard` skill.

## Test plan

- Vitest: the health route handler returns the commit from the environment (AC-4).
- The workflows are checked by pushing a trivial change after setup and watching both runs (AC-1, AC-2, AC-5). Record the run URLs in the issue.
- A deliberately failing migration on a throwaway commit, reverted afterwards, proves AC-3. Run this once, by a human.

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | Health route and `vercel.json` (region, Git deploys off) | AC-4 (route), AC-5, AC-6 | [#2](https://github.com/streetlampsalad/calories-counter/issues/2) |
| 2 | Setup wizard: create the Vercel project, set Vercel env vars and GitHub secrets (human-run) | AC-7 | [#3](https://github.com/streetlampsalad/calories-counter/issues/3) |
| 3 | Deploy workflow: migrate, then deploy, then health check | AC-1, AC-2, AC-3, AC-4 | [#4](https://github.com/streetlampsalad/calories-counter/issues/4) |

## Open questions

The owner accepted every default below on 2026-11-03; treat them as decisions.

- **Should CI cache the Supabase Docker images to speed up runs?** Default: no. Add it only if CI regularly takes longer than 10 minutes.
