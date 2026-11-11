# Contracts: Report a bug from inside the app

## `sendBugReport(input)` (new server action, `src/features/bug-reports/actions.ts`)

Input (from the browser, untrusted):

```ts
{
  whatWentWrong: string;          // required, 10–2,000 characters after trimming
  expected?: string;              // up to 2,000
  howItHappened?: string;         // up to 4,000
  screen?: "today" | "foods" | "summary" | "settings" | "other";
  severity: "blocked" | "annoying";
  device?: Record<string, unknown>; // Slice 2; parsed by parseDevice, never trusted
}
```

Result:

```ts
| { ok: true; issue: number; url: string }
| { ok: false; code: "not_found" | "invalid" | "limit" | "unavailable" }
```

Steps, in order (pseudocode):

```text
if no session or isToggleOn("feature-192") is false: return not_found
parse the fields; if invalid: return invalid
insert bug_reports row (service role) → id, or "limit" on bug_report_limit, or unavailable on error
toggles = my_toggles() with the User's session, filtered to is_on, Testing first; on error: "couldn't be read"
create the Issue (createFeatureIssues()) with bugIssueTitle and bugIssueBody(id, fields, toggles, version, device)
  on failure: delete the row, return unavailable
set bug_issue on the row
  on failure: close the Issue as not planned with "Couldn't be recorded by the app; the reporter was asked to try again.", delete the row, return unavailable
return ok with the Issue number and url = https://github.com/<REPOSITORY>/issues/<number>  (REPOSITORY from feature-requests/domain.ts)
```

## Bug Issue

- **Title**: `Bug: ` and the first line of What went wrong, neutralised, cut at a word to 70 characters with `…` (as spec 124's `issueTitle`).
- **Labels**: `bug`, `needs-triage`.
- **Body** (headings in this order, matching `.github/ISSUE_TEMPLATE/3-bug.yml`):

```markdown
### Steps to reproduce

Where in the app: Today  ← "Not given" when no screen was chosen; "Somewhere else" for other
                         ← blank line, then How it happened quoted, or _Not given_
### Expected

<What you expected, quoted, or _Not given_>

### Actual

<What went wrong, quoted>

### Device

- App version: abc1234
- Model: `Pixel 7`            ← Slice 2 lines from here, each value quoted as code
- Operating system: `Android 16`
- Browser: `Chrome 142`
- Opened as: `Installed app`
- Screen: `412 × 915 at 2.63×`
- Appearance: `System`
- Time zone: `Australia/Sydney`

### Toggles

- Report a bug (`feature-192`): Testing
- Tag Entries with a Meal time. (`feature-173`): Live
                         ← or "No Toggles on", or "Couldn't be read"
### How bad is it

A User cannot finish a main task (P1)      ← blocked; annoying gives "Annoying, with a workaround (P2)"

### Requested by

<the Bug report's id>

### Risk assessment

- [ ] Adds a third-party integration, secret, environment variable or dashboard step
- [ ] … every option of the template's checklist, unticked
```

User-written text is quoted with `> ` on every line and has `@` and `#<digit>` broken with a zero-width space (`quote` in `src/lib/issue-text.ts`). Device values are quoted as inline code (FR-008): neutralised, with backticks, line breaks and control or invisible characters removed, so a value cannot close the code, add a line or hide text. A field missing from what the browser sent is left out.

## Device (Slice 2, `src/features/bug-reports/device.ts`)

- `describeDevice(nav, win)` (browser), browser version major only (spec D1): reads `navigator.userAgentData.getHighEntropyValues(["model", "platformVersion"])` and the brands' major versions where present, else parses `navigator.userAgent`; `matchMedia("(display-mode: standalone)")`; `screen.width`, `screen.height`, `devicePixelRatio`; the stored Appearance; `Intl.DateTimeFormat().resolvedOptions().timeZone`. Returns `{ model, os, browser, openedAs, screen, appearance, timeZone }`, each a string, "Unknown" where it can't tell.
- `parseDevice(value)` (server): keeps only those seven keys, string values only, each trimmed and cut to 100 characters; anything else, or a value empty after trimming, is dropped. Returns `{}` for a non-object.

## Query keys

```ts
export const bugReportKeys = {
  all: ["bug-reports"] as const,
  sentToday: () => [...bugReportKeys.all, "sent-today"] as const,
};
```

`sentToday` counts the User's own `bug_reports` rows with `created_at` in the last 24 hours (RLS limits it to theirs). A successful send invalidates `bugReportKeys.all`. Sending is not optimistic: nothing shows as sent until GitHub has the Issue.

## Sync (Slice 3)

`scripts/workflow/bug-reports-sync.mjs`, run by a **Sync Bug reports** step in `.github/workflows/board.yml` after the Feature Request sync (and skipping with a warning, as it does, while the secret is not set):

```text
for each Issue labelled bug, open or closed in the last 30 days:
  if its body has no "### Requested by" with a UUID: skip (filed on GitHub)
  outcome =
    closed as completed                                   → fixed
    closed otherwise                                      → not_going_ahead
    needs-human-review on it, or on an open pull request
      whose body says Refs #<it>                          → waiting_for_owner
    labelled needs-triage                                 → sent
    otherwise                                             → being_fixed
  latest_comment = the newest comment's body from the Owner's side (author OWNER, MEMBER or COLLABORATOR,
    since anyone can comment on the public repo), skipping claim comments and deploy.yml's "In production as of …",
    without the attribution footer, cut to 2,000 characters
POST { updates: [...] } to $PRODUCTION_URL/api/bug-reports/sync, in batches of at most 500 (the route's cap)
  with header x-sync-secret: $FEATURE_REQUESTS_SYNC_SECRET (as spec 124's sync; checked with sameSecret)
  a 404 (the route not deployed yet) skips with a warning, as spec 124's sender does
```

The pure rules live in `scripts/workflow/bug-reports.mjs`, so they are tested without GitHub.

`POST /api/bug-reports/sync` (`src/app/api/bug-reports/sync/route.ts`, logic in `sync-handler.ts`):

- 401 without the right secret, before touching the database.
- 400 for a body that isn't `{ updates: [...] }` with each field of the right type and outcome.
- Calls `apply_bug_report_sync`, then for each returned row sends to each of the User's push subscriptions `{ title: "Fixed: <title>" | "Not going ahead: <title>"` (by `new_outcome`; the title shortened at a word to 60 characters as spec 124's notifications are), ` body: <start of the reason, 120 characters> | "Open it to see why.", url: "/settings/report-a-bug#<id>" }`, deleting subscriptions the push service says are gone (as spec 124's sync does).
- 200 `{ applied: <n>, notified: <n> }`.

## Triage (`bug.md`, Slice 3)

Two outcomes join Duplicate and A Bug, for every Bug:

- **Not a bug** (not a bug, not applicable, or, for an in-app Bug, can't be reproduced): one comment for the User in plain words saying why (for a Bug it can't reproduce, what was tried and to send a new report with steps), add `wontfix`, remove `needs-triage`, close as not planned.
- **Duplicate** of an in-app Bug: the comment says, in plain words, that someone already reported it and links the other Bug.
- Comment before closing, so the sync that the close starts carries the reason.
- **A Feature** (working as specified, or a new capability that needs a spec): the same, with the comment saying it is a new feature and to ask for it in **Feature requests**. This replaces the `needs-human-review` path for working-as-specified Bugs.

An in-app Bug (one with `### Requested by`) never gets `needs-info`.
