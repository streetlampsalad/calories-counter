# Calories Counter

A mobile-first calorie tracker for a few friends (Next.js on Vercel, Supabase in Sydney). Before changing anything, read:

- `CONTEXT.md`: the glossary. Use its terms exactly in code, UI copy, tests and commits (a **Food** has a **Portion**; an **Entry** has a **Quantity**).
- The spec you are implementing: `specs/<issue>-<name>/` (spec-kit), or a frozen one in `docs/specs/`. Its acceptance criteria are the definition of done.
- `docs/adr/` before changing anything an ADR covers.

## Workflow: Issue first, spec first, one pull request per Issue

Every change starts as an Issue and reaches `main` through a pull request (ADR 0007). To work on an Issue, run `/deliver #<n>`; `/deliver next` picks one. The process and its terms (Feature, Spec, Slice, Risk assessment, Human review, Done) are in `docs/agents/workflow.md`.

- Every merge leaves `main` deployable, so every new Feature ships behind its own Toggle, off for everyone: its first Slice adds the Toggle in a migration and every Slice gates its new behaviour on it with `useToggle` or `isToggleOn` (ADR 0008).
- Test first: a failing test for each acceptance criterion, then small commits. Iterate with `pnpm validate:fast` (the pre-push hook runs it).
- `pnpm validate` is the full gate, which CI runs on every pull request. Locally it needs Docker, `pnpm db:start` and `pnpm env:local`, and its `db:reset` wipes local data and re-seeds from `supabase/seed.sql`. Read CI's result and fix any failure.
- An Issue is done when its change is in production: pull requests say `Refs #<n>`, and `deploy.yml` closes the Issue.
- Add `needs-human-review` whenever the Risk assessment ticks anything; only the owner removes it.

When a hook fails, fix the cause. Skipping hooks, force-pushing, pushing to `main`, merging pull requests, removing `needs-human-review`, editing `.env*` files and touching the production database are blocked by `.claude/hooks/guard.mjs`. If one of those seems necessary, stop and ask the human.

## Cloud agents

Cloud sessions have no Docker, so `pnpm validate` runs only the fast checks there; write the database and e2e tests anyway, because CI runs them. Work on the `claude/*` branch you were given. The GitHub proxy blocks GraphQL, so `gh issue` and `gh pr` fail: use the `gh api` REST recipes in `.claude/skills/deliver/github.md`.

## Where tests go

| What | Where | Tool |
|---|---|---|
| Pure logic (totals, Period ranges, kJ conversion, parsing) | `src/**/*.test.ts` | Vitest |
| Components | `src/**/*.test.tsx`, query by role and label | Testing Library |
| Schema, RLS, database functions | `supabase/tests/database/*.test.sql` | pgTAP |
| User journeys | `e2e/*.spec.ts` | Playwright (Pixel 7) |
| Workflow scripts (merge gate, board) | `scripts/workflow/*.test.mjs` | Vitest |

Every new table gets pgTAP tests proving one User cannot read or change another User's rows.

## Database

- Change the schema only with a new migration: `pnpm db:new <name>`, then `pnpm db:reset && pnpm db:types`. Committed migrations are immutable.
- Each migration must work with the app version currently deployed, because migrations ship a few minutes before the app (ADR 0003).
- Every `public` table has RLS enabled and at least one policy. `000_guardrails.test.sql` enforces this.
- Calories are whole-number kcal. A Day is a `date`, never a timestamp. Daily Totals are computed from Entries and current Food Calories, never stored (ADR 0001).

## App code

- Browser data access goes through TanStack Query, and each feature keeps its query keys in one factory. Logging mutations are optimistic and roll back on error.
- Use the Supabase clients in `src/lib/supabase/`. Third-party API keys (such as Gemini) are read only on the server: route handlers or server actions, never `NEXT_PUBLIC_*`.
- Design for a 360–412 px wide Android phone first. Touch targets are at least 44 px, and the main actions sit within thumb reach at the bottom of the screen.
- UI building blocks come from shadcn/ui (`pnpm dlx shadcn@4.23.0 add <component>`) into `src/components/ui/`.
- Copy is in Australian English, with metric units.

## Agent skills

- Issue tracker: GitHub Issues on `streetlampsalad/calories-counter`; conventions in `docs/agents/issue-tracker.md`.
- Triage labels: `docs/agents/triage-labels.md`.
- Domain docs: single-context, `CONTEXT.md` and `docs/adr/` at the repo root; see `docs/agents/domain.md`.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
