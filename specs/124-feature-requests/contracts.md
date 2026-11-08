# Contracts: Feature Requests

## Server action `submitFeatureRequest`

`src/app/(app)/settings/feature-requests/actions.ts`

- Input: `{ goal: string, problem?: string, details?: string }`, validated by `parseFeatureRequest` (zod) in `src/features/feature-requests/domain.ts`.
- Refuses with `{ ok: false, code: "not_found" }` unless `isToggleOn("feature-114")`.
- Inserts the row with the admin client (`user_id` from `getClaims()`), creates the Issue through `FeatureIssues.create`, then stores `feature_issue`. If the Issue cannot be created, deletes the row.
- Returns `{ ok: true, id }`, or `{ ok: false, code: "limit" | "invalid" | "unavailable" }`.

## Server action `withdrawFeatureRequest`

- Input: `{ id: string }`. Refuses unless the Toggle is on, the caller owns the request, and its stage is `submitted`, `being_reviewed` or `planning` and it is not withdrawn.
- Comments "Withdrawn by the requester." on the Feature Issue and the Spec Issue (if any), closes each as not planned, then sets `withdrawn_at`.
- Returns `{ ok: true }` or `{ ok: false, code: "not_allowed" | "unavailable" }`.

## `FeatureIssues` (`src/features/feature-requests/feature-issues.ts`)

```ts
type FeatureIssues = {
  create(input: { title: string; body: string }): Promise<{ number: number }>;
  close(number: number, comment: string): Promise<void>;
};
```

`createFeatureIssues(env)` returns the GitHub client (REST, `GITHUB_FEATURE_REQUESTS_TOKEN`) or, when `FEATURE_ISSUES=fake`, an in-memory fake numbered from 90000. With neither, `create` throws, so submitting answers `unavailable`.

## Route `POST /api/feature-requests/sync`

Called only by `scripts/workflow/feature-requests-sync.mjs` from `board.yml`.

- Header `x-sync-secret`: must equal `FEATURE_REQUESTS_SYNC_SECRET` (compared as digests, like the Reminder route). Otherwise `401 { code: "unauthorized" }`.
- Body: `{ requests: [{ featureIssue: number, stage: Stage, specIssue: number | null, latestComment: string | null, readyNote: string | null }] }`, at most 200 entries. Otherwise `400 { code: "invalid" }`.
- Calls `apply_feature_request_sync`, then sends one push per device of each returned Requester: `{ title: "Ready to try: <goal start>", body: "Turn it on to try it.", url: "/settings/feature-requests#<id>" }` or `{ title: "Not going ahead: <goal start>", body: <latest comment start>, url: … }`. Expired subscriptions are deleted.
- `200 { updated: number, notified: number }`.

## Sync script

`scripts/workflow/feature-requests-sync.mjs`, pure rules in `scripts/workflow/feature-requests.mjs`:

- Lists Feature Issues (`labels=feature`, open, and closed within 30 days) whose body's `### Requested by` is a UUID.
- For each, reads its Spec sub-issue, the Spec's sub-issues, its and its Spec's comments, and the open pull requests that refer to any of them; `stageFor(tree)` gives the stage (US2.1, D5).
- `readyNote`: the `## Ready to try` section of the spec folder named in the Spec Issue's `### Spec folder`, read from `main`.
- `latestComment`: the first line of the newest comment on the Feature or its Spec that is not "Claimed by /deliver".
- POSTs them to `${PRODUCTION_URL}/api/feature-requests/sync`. With no `FEATURE_REQUESTS_SYNC_SECRET`, it warns and exits 0, like the board sync.
