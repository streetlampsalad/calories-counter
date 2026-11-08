# Contracts: Feedback, Ready and Remove

All three server actions live in `src/features/feature-requests/actions.ts`, take `{ id: string, … }`, and check, before anything else: `feature-114` is on for the caller, the caller owns the request, it is not withdrawn, its stage is `ready_to_try`, and its Toggle `feature-<feature_issue>` is in Testing. Otherwise they answer `{ ok: false, code: "not_allowed" }`.

## `giveFeedback({ id, feedback })`

- `feedback` 10–4,000 characters after trimming, else `invalid`.
- `limit` when the caller has 2 other requests at an open stage.
- Starts the Round with `start_feature_request_round()` (which also puts the request back at `submitted`), creates the follow-up Feature Issue through `FeatureIssues.create` (`followUpTitle`, `followUpBody`), and stores its number on the Round. If the Issue cannot be created, `undo_feature_request_round()` deletes the Round and puts the request back as it was (stage, when it changed, comment and note) in one statement; if its number cannot be stored, also closes the Issue again (as `submitFeatureRequest` does).
- Returns `{ ok: true }` or `{ ok: false, code: "not_allowed" | "invalid" | "limit" | "unavailable" }`.

Follow-up Issue: title `Feature: Feedback on <goal start>`; headings `### Problem` (the feedback, quoted), `### Who has it` ("The requester."), `### Desired outcome` (the original goal, quoted), `### Additional details` ("Round <n> of #<original>."), `### Follow-up to` (`#<original Feature Issue>`), `### Requested by` (the request id); labels `feature`, `needs-triage`, `priority:P1`.

## `withdrawFeatureRequest({ id })` (changed)

- Also answers `not_allowed` once the request has been Ready to try: `markWithdrawn`'s update adds `first_ready_at is null` (D12).

## `markReady({ id })` and `removeFeature({ id })`

- Creates the Chore through `FeatureIssues.create`:
  - Ready: title `Chore: Remove the Toggle for #<n>`; `### What`: delete every `useToggle("feature-<n>")` and `isToggleOn("feature-<n>")` check, keeping the "on" path; the Toggle's row stays, because the Feature Request's card reads it to say Live for everyone; `### Why`: the Toggle is Live (ADR 0008).
  - Remove: title `Chore: Remove the feature for #<n>`; `### What`: delete the code behind `feature-<n>` and, in a migration, any table or column only it used; the Toggle's row stays, because the card reads it to say Removed; `### Why`: the Toggle is Removed (ADR 0008).
  - Both: `### Behaviour` ticks "No User-visible behaviour changes"; labels `chore`, `ready-for-agent`, `priority:P2`.
- Then, with the service role: `update toggles set state = 'live' | 'removed' where key = 'feature-<n>' and state = 'testing'`, and on the request `decision` and `cleanup_issue`. If no row changed, closes the Chore as not planned ("The Toggle was no longer in Testing.") and answers `not_allowed`.
- Returns `{ ok: true }` or `{ ok: false, code: "not_allowed" | "unavailable" }`.

## The sync

- `scripts/workflow/feature-requests-sync.mjs` sends every Feature Issue with a `### Requested by`, a Round's too; `apply_feature_request_sync` applies only each request's newest recorded Issue, so an Issue the app did not create changes nothing.
- `POST /api/feature-requests/sync`, after recording stages and sending stage notifications, calls `due_testing_reminders()` and sends each returned Requester `{ title: "Still trying: <goal start>?", body: "Mark it ready, give feedback or remove it.", url: "/settings/feature-requests#<id>" }`. The response gains `reminded: number`.
