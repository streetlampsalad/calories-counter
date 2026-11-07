# Triage a Feature

Decide whether this Feature should be built. A triage produces a decision, not a pull request.

Read the Feature's `### Problem`, `### Who has it`, `### Desired outcome` and `### Requested by` sections (an Issue created through the API has the same headings), `CONTEXT.md`, the spec index in `docs/specs/README.md`, the folders in `specs/`, and open `feature` and `spec` Issues.

If a human already labelled this Feature `ready-for-agent`, it is accepted: go straight to **Accept**.

## Decide

- **Accept** when it fits a calorie tracker for a few friends, is not a duplicate, and is specific enough to write a spec from.
- **Reject** when it is a duplicate, out of the product's scope, or harmful to Users.
- **Ask** when the answer turns on a product judgement only the owner can make, or the Feature is too vague to specify.

## Accept

1. Create the Spec Issue: title `Spec: <title>`, labels `spec`, `ready-for-agent` and the Feature's priority label, and a body with the Spec template's headings (`### Feature` = `#<feature>`, `### Summary`, `### Human review` = `Not assessed yet`).
2. Add it as a sub-issue of the Feature.
3. On the Feature: remove `needs-triage` and `ready-for-agent`, unassign yourself, and comment `Accepted: specified in #<spec>`.

## Reject

Comment with the reason in one or two sentences, add `wontfix`, remove `needs-triage`, and close the Issue as not planned.

## Ask

Comment with the specific questions, add `needs-human-review`, remove `needs-triage`, and unassign yourself.

Done when the Feature has exactly one of those three outcomes recorded. Then stop: the Spec is a separate run.
