# Bug

Wrong behaviour, fixed with a regression test. The definition of done is a test that goes red on the bug, then green with the fix.

## 1. Triage

Read the Bug's `### Steps to reproduce`, `### Expected`, `### Actual`, `### Device` and `### How bad is it`, then decide:

- **Duplicate** of an open Bug: comment `Duplicate of #<n>`, add `wontfix`, remove `needs-triage`, and close it as not planned.
- **Working as specified** (the spec or `CONTEXT.md` asks for the behaviour reported): it is a Feature. Comment with the spec line, add `needs-human-review`, remove `needs-triage`, unassign yourself, and stop.
- **A Bug**: remove `needs-triage` and set `priority:P0`, `P1` or `P2` from `### How bad is it` when no priority label is set.

## 2. Reproduce it in a test

Write the regression test first, at the lowest layer that shows the bug (`AGENTS.md` "Where tests go"): pure logic before a component, a component before a journey. Run it and see it go **red** for the reason the Bug reports.

In a cloud session there is no database or browser stack, so pgTAP and e2e tests cannot run there. Reproduce in a Vitest test where the bug can be shown there. Where it needs the database or a real journey, write that test from the code path, and say in the pull request that only CI has run it.

When it does not reproduce: comment with what you tried, add `needs-info`, unassign yourself, and stop.

## 3. Find the cause, then fix it

Trace from the red test to the line that is wrong, and say in one sentence why it is wrong (the `/diagnosing-bugs` skill where it is installed). Fix that cause. A fix that only hides the symptom at the surface leaves the bug for the next caller.

Search for the same mistake elsewhere and fix each copy, with a test for each. A Bug gets no Toggle (ADR 0008): the fix is Live as soon as it deploys.

## 4. Risk assessment

Tick the conditions in the Bug's checklist that apply. A fix that rewrites or deletes User data, or changes an RLS policy, needs Human review.

Done when the regression test is red without the fix and green with it (or written for CI to run, from the cloud), `pnpm validate` passes (the fast checks in the cloud), and the pull request says what the cause was. Then hand over ([SKILL.md](SKILL.md) step 4).
