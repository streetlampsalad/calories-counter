# Spec

Specs use spec-kit with this repo's template overrides in `.specify/templates/overrides/` and the constitution in `.specify/memory/constitution.md`. Specs 001–019 in `docs/specs/` are frozen history; read the ones the new spec depends on.

## A. Write the spec (ends in a Spec pull request)

1. **Folder**: `specs/<spec issue number>-<short-name>/`. Set `SPECIFY_FEATURE_DIRECTORY` to it for every spec-kit step, so parallel sessions never collide on a number.
2. **Specify**: run `/speckit-specify` with the Feature's problem, who has it and desired outcome as the description. Fill the header (Spec issue, Feature, Depends on, ADRs).
3. **Self-interview**: grill your own draft as a sceptical owner would, relentlessly: every ambiguity, edge case, empty or error state, and design fork. Answer each one from the code, `CONTEXT.md` and the ADRs, and log it in **Decisions** with the rejected alternatives and your confidence. Then run `/speckit-clarify` and answer its questions the same way. Done when no `[NEEDS CLARIFICATION]` marker is left and every Decision has an answer.
4. **Glossary**: add any new term to `CONTEXT.md` in the same pull request.
5. **Ready to try**: fill the spec's `## Ready to try` section for the User who will try the feature: where to find it, how to try it, and the guesses they might want changed, in plain words with no code or process. A Feature Request's card shows it once the feature is in production (spec 124); `scripts/workflow/ready-to-try.test.mjs` fails a spec without it.
6. **Plan**: run `/speckit-plan`. Every acceptance scenario appears in the Test Plan table.
7. **Tasks**: run `/speckit-tasks`. Each user story is one Slice, and the Slices table at the end of `tasks.md` is filled. The first Slice adds the Feature's Toggle, `feature-<Feature issue number>`, and every Slice gates its new behaviour on it (ADR 0008). A Feature with `### Follow-up to #<original>` (a Round, spec 135) instead changes the feature behind the existing Toggle `feature-<original>` and adds no new Toggle: its Slices change what the Requester is trying, and the spec's `## Ready to try` says what changed.
8. **Analyze**: run `/speckit-analyze` and fix every inconsistency it reports until it reports none.
9. **Risk assessment**: answer every row of the spec's table. Any "yes", or any low-confidence Decision on a risk condition, means Human review for the spec. Name the Slices that carry the risk. Add `size:<XS–XL>` to the Spec Issue; L or XL also means Human review.
10. **Hand over** ([SKILL.md](SKILL.md) step 4) with `Refs #<spec issue>`. Add `needs-human-review` to the pull request if the spec needs Human review.
11. **Release the Issue**: remove `ready-for-agent` and unassign yourself, so part B can claim it after the merge. Set the Spec Issue's `### Spec folder` and `### Human review` in its body.

Write no production code in a Spec pull request. Merging it is the spec's approval.

## B. Create the Slices (after the Spec pull request merged)

For each row of the Slices table in `tasks.md`, in order:

1. Create a Slice Issue from the Slice template's headings: title `[<spec issue>] <slice title>`, labels `slice`, `ready-for-agent` and the Spec's priority label, with the spec folder, the scenarios it covers copied verbatim, its task IDs, and its Risk assessment ticks.
2. Add it as a sub-issue of the Spec Issue.
3. Add a "blocked by" dependency for each Slice it is blocked by.

Done when every row has an Issue, every sub-issue link and dependency exists, and the Spec Issue has a comment listing the Slices. Unassign yourself from the Spec, then run `/deliver next`: the first Slice is usually next.
