# Calories Counter

A mobile-first calorie tracker for a few friends (Next.js on Vercel, Supabase in Sydney). Before changing anything, read:

- `CONTEXT.md`: the glossary. Use its terms exactly in code, UI copy, tests and commits (a **Food** has a **Portion**; an **Entry** has a **Quantity**).
- The spec you are implementing in `docs/specs/`. Its acceptance criteria are the definition of done.
- `docs/adr/` before changing anything an ADR covers.

## Workflow: trunk-based

Commit directly to `main` (ADR 0003). Every commit must leave `main` deployable, so a feature stays unreachable (no navigation link, no route) until its last issue lands.

1. Pick one issue. Write a failing test for each acceptance criterion first.
2. Make it pass in small commits. Iterate with `pnpm validate:fast`.
3. Before pushing, `pnpm validate` must pass (the pre-push hook runs it). It needs Docker, `pnpm db:start` and `pnpm env:local`. It runs `db:reset`, which wipes local data and re-seeds from `supabase/seed.sql`.
4. An issue is done when `validate` passes and every acceptance criterion has a test that would fail without the change.

When a hook fails, fix the cause. Skipping hooks, force-pushing, editing `.env*` files and touching the production database are blocked by `.claude/hooks/guard.mjs`. If one of those seems necessary, stop and ask the human.

## Where tests go

| What | Where | Tool |
|---|---|---|
| Pure logic (totals, Period ranges, kJ conversion, parsing) | `src/**/*.test.ts` | Vitest |
| Components | `src/**/*.test.tsx`, query by role and label | Testing Library |
| Schema, RLS, database functions | `supabase/tests/database/*.test.sql` | pgTAP |
| User journeys | `e2e/*.spec.ts` | Playwright (Pixel 7) |

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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
