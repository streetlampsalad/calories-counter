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
return ok with the Issue number and its html URL
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
- Model: Pixel 7              ← Slice 2 lines from here
- Operating system: Android 16
- Browser: Chrome 142.0.7444.0
- Opened as: Installed app
- Screen: 412 × 915 at 2.6×
- Appearance: System
- Time zone: Australia/Sydney

### Toggles

- Meal times (`feature-173`): Testing
- Feature requests (`feature-114`): Live
                         ← or "No Toggles on", or "Couldn't be read"
### How bad is it

A User cannot finish a main task (P1)      ← blocked; annoying gives "Annoying, with a workaround (P2)"

### Requested by

<the Bug report's id>

### Risk assessment

- [ ] Adds a third-party integration, secret, environment variable or dashboard step
- [ ] … every option of the template's checklist, unticked
```

User-written text is quoted with `> ` on every line and has `@` and `#<digit>` broken with a zero-width space (`quote` in `src/lib/issue-text.ts`). Device values are neutralised and have backticks and line breaks removed.

## Device (Slice 2, `src/features/bug-reports/device.ts`)

- `describeDevice(nav, win)` (browser): reads `navigator.userAgentData.getHighEntropyValues(["model", "platformVersion", "fullVersionList"])` where present, else parses `navigator.userAgent`; `matchMedia("(display-mode: standalone)")`; `screen.width`, `screen.height`, `devicePixelRatio`; the stored Appearance; `Intl.DateTimeFormat().resolvedOptions().timeZone`. Returns `{ model, os, browser, openedAs, screen, appearance, timeZone }`, each a string, "Unknown" where it can't tell.
- `parseDevice(value)` (server): keeps only those seven keys, string values only, each trimmed and cut to 100 characters; anything else is dropped. Returns `{}` for a non-object.

## Query keys

```ts
export const bugReportKeys = {
  all: ["bug-reports"] as const,
  sentToday: () => [...bugReportKeys.all, "sent-today"] as const,
};
```

`sentToday` counts the User's own `bug_reports` rows with `created_at` in the last 24 hours (RLS limits it to theirs). A successful send invalidates `bugReportKeys.all`. Sending is not optimistic: nothing shows as sent until GitHub has the Issue.
