# Implementation Plan: Toggles for every new Feature

**Spec**: [spec.md](./spec.md) | **Spec issue**: #116 | **Date**: 2026-11-08

## Summary

Two Supabase tables hold each Toggle and each User's override, and one database function, `toggle_is_on`, decides whether a Toggle is on for the caller. The browser reads every Toggle at once through `my_toggles()` with TanStack Query and the server asks `toggle_is_on` per key; both treat missing or failed as off. The Owner, marked on their Allowed Email, gets a "Try new features" section in Settings. A final Slice rewrites the repo's rules and `/deliver` so every new Feature ships behind a Toggle (ADR 0008).

## Technical Context

- **Stack**: Next.js (App Router, `node_modules/next` is newer than most training data), React, TanStack Query, shadcn/ui on Base UI, Tailwind, Supabase (Postgres with RLS) in Sydney, Vercel
- **New dependencies**: none (the shadcn `Switch` is already in `src/components/ui/`)
- **Data**: `allowed_emails.is_owner`, tables `toggles` and `toggle_overrides`, functions `is_owner`, `can_try_toggle`, `can_switch_toggle`, `toggle_is_on`, `my_toggles` ([data-model.md](./data-model.md))
- **Server boundaries**: no new route; `isToggleOn(key)` in `src/features/toggles/server.ts` calls `toggle_is_on` with the request's Supabase client, for Server Components and route handlers
- **Query keys**: `toggleKeys` in `src/features/toggles/queries.ts`: `all: ["toggles"]`, `mine: () => ["toggles", "mine"]`
- **Screens and states**: Settings gains `TryFeaturesSection`. Loading: renders nothing. Error: renders nothing (Toggles are off). Empty (no Toggle the User can switch): renders nothing. Offline save: rolls back with a toast, "Couldn't save. Check your connection and try again."

## Constitution Check

- [x] I. Glossary terms used exactly; Owner, Toggle, Testing, Live and Removed added to `CONTEXT.md`
- [x] II. Every acceptance scenario has a test at the right layer (below)
- [x] III. Each Slice leaves `main` deployable. The constitution's "there is no feature-flag system" is what this spec replaces: until Slice 3 rewrites it, nothing is reachable, because no Toggle exists and the Settings section hides when empty
- [x] IV. Migrations are new and additive; Daily Totals untouched
- [x] V. No secret reaches the browser; no new secret at all
- [x] VI. The section's rows are whole-row labels at least 48 px tall, like the Vibration row; copy in Australian English
- [x] VII. The Risk assessment holds: RLS and a human step in Slice 1, guardrails in Slice 3, ADR 0008 in the spec

## Test Plan

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | pgTAP, Vitest | `supabase/tests/database/019_toggles.test.sql`, `src/features/toggles/server.test.ts`, `src/features/toggles/queries.test.tsx` |
| US1.2 | pgTAP | `supabase/tests/database/019_toggles.test.sql` |
| US1.3 | pgTAP | `supabase/tests/database/019_toggles.test.sql` |
| US1.4 | pgTAP | `supabase/tests/database/019_toggles.test.sql` |
| US1.5 | pgTAP | `supabase/tests/database/019_toggles.test.sql` |
| US1.6 | pgTAP | `supabase/tests/database/019_toggles.test.sql` |
| US1.7 | pgTAP | `supabase/tests/database/019_toggles.test.sql` |
| US1.8 | pgTAP | `supabase/tests/database/019_toggles.test.sql` |
| US1.9 | Vitest | `src/features/toggles/queries.test.tsx`, `src/features/toggles/server.test.ts` |
| US2.1 | Testing Library, Playwright | `src/features/settings/try-features-section.test.tsx`, `e2e/toggles.spec.ts` |
| US2.2 | Testing Library, Playwright | `src/features/settings/try-features-section.test.tsx`, `e2e/toggles.spec.ts` |
| US2.3 | Testing Library | `src/features/settings/try-features-section.test.tsx` |
| US2.4 | Testing Library, Playwright | `src/features/settings/try-features-section.test.tsx`, `e2e/toggles.spec.ts` |
| US2.5 | Testing Library | `src/features/settings/try-features-section.test.tsx` |
| US3.1 | Review | the changed documents, checked by `grep` for "unreachable until" and "feature-flag" |
| US3.2 | Review | `.claude/skills/deliver/triage.md` |
| US3.3 | Review | `.claude/skills/deliver/change.md` |

## Migration Plan

1. **Slice 1, `toggles`**: adds `allowed_emails.is_owner` with a default, the two tables with RLS, the trigger and the five functions. The deployed app never reads any of them, so it is safe minutes before the new app; the new app works with no Toggle rows.
2. **Slice 2**: no migration. `supabase/seed.sql` (local and CI only) adds an Owner test User, `gus@example.test` with `is_owner`, and one Toggle `feature-0`, "Example feature", in Testing, for the e2e journey.

After Slice 1 deploys, the Owner sets `is_owner = true` on their Allowed Email in production in the Supabase dashboard (`human-step`).

## Project Structure

### Documentation (this feature)

```text
specs/116-toggles/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/(app)/settings/page.tsx                 # adds TryFeaturesSection
├── features/toggles/
│   ├── queries.ts                              # toggleKeys, useToggles, useToggle, useSwitchToggle
│   ├── queries.test.tsx
│   ├── server.ts                               # isToggleOn(key)
│   └── server.test.ts
├── features/settings/
│   ├── try-features-section.tsx
│   └── try-features-section.test.tsx
└── lib/supabase/database.types.ts              # regenerated
supabase/
├── migrations/<timestamp>_toggles.sql
├── seed.sql                                    # Owner test User and an example Toggle
└── tests/database/019_toggles.test.sql
e2e/
├── support/auth.ts                             # gus
└── toggles.spec.ts
docs and rules (Slice 3):
├── .specify/memory/constitution.md             # principle III
├── AGENTS.md                                   # "Every merge leaves main deployable"
├── docs/agents/workflow.md                     # the flow and Done
├── .specify/templates/overrides/{plan,tasks}-template.md
└── .claude/skills/deliver/{spec,change,triage}.md
```

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Constitution III says there is no feature-flag system | This spec is the decision to have one (ADR 0008); Slice 3 amends the constitution with Human review | Amending the constitution first would point agents at helpers that do not exist yet |
