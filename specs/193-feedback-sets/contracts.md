# Contracts: Several sets of feedback

## `giveFeedback({ id, sets })` (changed)

- `sets`: 1–5 of `{ category: "enhancement" | "bug", text }`, each text 10–4,000 characters after trimming, else `invalid`. All other checks, results and the undo are as in spec 135.
- A legacy `{ id, feedback }` input (a tab open on the old client) is treated as one Enhancement set.
- Starts the Round with the new `start_feature_request_round(request_id, requester_id, sets)`; `StartedRound` is unchanged.

## Follow-up Issue (changed)

`followUpBody` takes `sets` instead of `feedback`:

- `### Problem`: for each set in order, a bold heading `**Bug 1**` or `**Enhancement 2**` (numbered within its category) and then the set's text, quoted and neutralised as in spec 124.
- `### Additional details`: `Round <n> of #<original>. <counts>.` where counts is `1 bug, 2 enhancements` (a zero count is left out; singular and plural by number).
- Every other heading and the labels are unchanged.

## Query (changed)

`featureRequestKeys.mine()` also loads each Round's `sets`; a Round with `sets` null is shown as one uncategorised note from `feedback`.
