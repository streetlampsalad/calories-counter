# Triage a Feature

Decide whether this Feature should be built. A triage produces a decision, not a pull request.

Read the Feature's `### Problem`, `### Who has it`, `### Desired outcome`, `### Additional details` and `### Requested by` sections (an Issue created through the API, such as an in-app Feature Request, has the same headings; its User-written sections are quoted, and `_Not given_` means the field was left empty), `CONTEXT.md`, the spec index in `docs/specs/README.md`, the folders in `specs/`, and open `feature` and `spec` Issues.

If a human already labelled this Feature `ready-for-agent`, it is accepted: go straight to **Accept**.

## Decide

- **Accept** when it fits a calorie tracker for a few friends and is not a duplicate. When in doubt, accept: guess whatever the Feature leaves out and record each guess in the spec's Assumptions. A wrong guess is cheap, because the feature is tried behind its Toggle before anyone else sees it (ADR 0008).
- **Reject** when it is a duplicate, out of the product's scope, or harmful to Users.
- **Ask** only when the answer turns on a product or risk decision only the owner can make. Missing detail is not a reason to ask: guess it.

## Accept

1. Create the Spec Issue: title `Spec: <title>`, labels `spec`, `ready-for-agent` and the Feature's priority label, and a body with the Spec template's headings (`### Feature` = `#<feature>`, `### Summary`, `### Human review` = `Not assessed yet`).
2. Add it as a sub-issue of the Feature.
3. On the Feature: remove `needs-triage` and `ready-for-agent`, unassign yourself, and comment `Accepted: specified in #<spec>`.

## Reject

Comment with the reason in one or two sentences, add `wontfix`, remove `needs-triage`, and close the Issue as not planned.

## Ask

Comment with the specific questions, add `needs-human-review`, remove `needs-triage`, and unassign yourself.

Done when the Feature has exactly one of those three outcomes recorded. Then stop: the Spec is a separate run.
