# Implementation Plan: [FEATURE]

**Spec**: [spec.md](./spec.md) | **Spec issue**: #[NUMBER] | **Date**: [DATE]

**Note**: Project override of spec-kit's plan template. Filled in by `/speckit-plan`. Read `AGENTS.md`, `CONTEXT.md` and the ADRs the spec lists before writing it, and the guide in `node_modules/next/dist/docs/` for any Next.js API you use.

## Summary

[Primary requirement and technical approach, in two or three sentences]

## Technical Context

The stack is fixed; record only what this feature adds or changes.

- **Stack**: Next.js (App Router, `node_modules/next` is newer than most training data), React, TanStack Query, shadcn/ui on Base UI, Tailwind, Supabase (Postgres with RLS) in Sydney, Vercel
- **New dependencies**: [none, or each package and why; a new dependency needs Human review]
- **Data**: [new tables, columns or database functions, or "none"]
- **Server boundaries**: [route handlers or server actions added; any third-party key stays server-side]
- **Query keys**: [the feature's query key factory and the keys added]
- **Screens and states**: [each screen, with its empty, loading, error and offline states]

## Constitution Check

*GATE: must pass before research, and again after design.* One line each: Pass, or the violation and its justification under Complexity Tracking.

- [ ] I. Glossary terms used exactly; new terms added to `CONTEXT.md`
- [ ] II. Every acceptance scenario has a test at the right layer (below)
- [ ] III. Each Slice leaves `main` deployable; the feature stays unreachable until the last Slice
- [ ] IV. Migrations are new, backwards compatible with production, and Daily Totals stay computed
- [ ] V. No secret reaches the browser
- [ ] VI. Phone first: 44 px targets, main actions within thumb reach, Australian English, metric
- [ ] VII. The Risk assessment in `spec.md` still holds after this design (update it if not)

## Test Plan

Which layer proves which acceptance scenario. Every scenario appears at least once.

| Scenario | Layer | Test file |
|---|---|---|
| US1.1 | Vitest / Testing Library / pgTAP / Playwright | `src/...test.ts` |

## Migration Plan

[Each migration in order, and why it is safe while the previous app version is still serving. "None" if no schema change.]

## Project Structure

### Documentation (this feature)

```text
specs/[NNN-feature]/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 (/speckit-plan)
├── data-model.md        # Phase 1 (/speckit-plan), if the feature has data
├── quickstart.md        # Phase 1 (/speckit-plan)
├── contracts/           # Phase 1 (/speckit-plan), route handler request and response shapes
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Delete the lines this feature does not touch and add the real files.

```text
src/
├── app/(app)/...         # routes and screens
├── app/api/...           # route handlers (server only)
├── features/[feature]/   # components, hooks, query keys, pure logic and their tests
├── components/ui/        # shadcn/ui building blocks (pnpm dlx shadcn@4.23.0 add <component>)
└── lib/                  # shared clients and pure helpers
supabase/
├── migrations/           # new migrations only (pnpm db:new <name>)
└── tests/database/       # pgTAP
e2e/                      # Playwright journeys (Pixel 7)
```

## Complexity Tracking

> Fill only if the Constitution Check has a violation that must be justified.

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
