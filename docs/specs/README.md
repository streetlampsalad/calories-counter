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

| # | Spec | Depends on | Status | Tracking issue |
|---|---|---|---|---|
| 001 | [Environments and deploy pipeline](001-environments-and-deploy.md) | — | Done | [#1](https://github.com/streetlampsalad/calories-counter/issues/1) |
| 002 | [Sign in with Google and the app shell](002-sign-in-and-app-shell.md) | 001 | Ready | [#5](https://github.com/streetlampsalad/calories-counter/issues/5) |
| 003 | [Food List](003-food-list.md) | 002 | Done | [#11](https://github.com/streetlampsalad/calories-counter/issues/11) |
| 004 | [Add Food: manual entry](004-add-food-manual.md) | 003 | Ready | [#16](https://github.com/streetlampsalad/calories-counter/issues/16) |
| 005 | [Add Food: file import and Import Review](005-add-food-file-import.md) | 004 | Ready | [#20](https://github.com/streetlampsalad/calories-counter/issues/20) |
| 006 | [Add Food: photo of handwritten notes](006-add-food-photo-import.md) | 005 | Ready | [#26](https://github.com/streetlampsalad/calories-counter/issues/26) |
| 007 | [Add Food: search and best guess](007-add-food-search.md) | 004 | Ready | [#31](https://github.com/streetlampsalad/calories-counter/issues/31) |
| 008 | [Daily logging](008-daily-logging.md) | 003 | Ready | [#38](https://github.com/streetlampsalad/calories-counter/issues/38) |
| 009 | [Settings and Goal](009-settings-and-goal.md) | 002 | Ready | [#45](https://github.com/streetlampsalad/calories-counter/issues/45) |
| 010 | [Summaries](010-summaries.md) | 008, 009 | Ready | [#50](https://github.com/streetlampsalad/calories-counter/issues/50) |
| 011 | [Insights](011-insights.md) | 010 | Ready | [#55](https://github.com/streetlampsalad/calories-counter/issues/55) |
| 012 | [Installable app](012-installable-app.md) | 002 | Ready | [#62](https://github.com/streetlampsalad/calories-counter/issues/62) |

The critical path is 001 → 002 → 003 → 004 → 008 → 010. Specs 005–007, 009, 011 and 012 can run alongside it once their dependencies land.
