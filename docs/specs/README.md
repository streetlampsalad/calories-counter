# Specs

Each spec describes one capability. Its **Issue breakdown** lists thin, vertical slices, each of which becomes one GitHub issue. Write specs from [`_template.md`](_template.md), and use the glossary terms in [`../../CONTEXT.md`](../../CONTEXT.md).

## Lifecycle

`Draft` → `Ready` (a human has reviewed it and the open questions are answered) → `In progress` (issues created) → `Done` (every issue closed and every acceptance criterion tested).

## Turning a spec into issues

Create one issue per row in the spec's **Issue breakdown** using the *Spec slice* issue template:

- Title: `[NNN] <slice title>`, labelled `spec:NNN`.
- Body: the acceptance criteria the slice covers, copied verbatim (for example AC-3, AC-4), plus a link to the spec.
- Slices that depend on an earlier slice say so with `Blocked by #<issue>`.

## Index

| # | Spec | Depends on | Status |
|---|---|---|---|
| 001 | [Environments and deploy pipeline](001-environments-and-deploy.md) | — | Draft |
| 002 | [Sign in with Google and the app shell](002-sign-in-and-app-shell.md) | 001 | Draft |
| 003 | [Food List](003-food-list.md) | 002 | Draft |
| 004 | [Add Food: manual entry](004-add-food-manual.md) | 003 | Draft |
| 005 | [Add Food: file import and Import Review](005-add-food-file-import.md) | 004 | Draft |
| 006 | [Add Food: photo of handwritten notes](006-add-food-photo-import.md) | 005 | Draft |
| 007 | [Add Food: search and best guess](007-add-food-search.md) | 004 | Draft |
| 008 | [Daily logging](008-daily-logging.md) | 003 | Draft |
| 009 | [Settings and Goal](009-settings-and-goal.md) | 002 | Draft |
| 010 | [Summaries](010-summaries.md) | 008, 009 | Draft |
| 011 | [Insights](011-insights.md) | 010 | Draft |
| 012 | [Installable app](012-installable-app.md) | 002 | Draft |

The critical path is 001 → 002 → 003 → 004 → 008 → 010. Specs 005–007, 009, 011 and 012 can run alongside it once their dependencies land.
