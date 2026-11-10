# Feature Specification: Report a bug from inside the app

**Spec issue**: #194

**Feature**: #192

**Created**: 2026-11-10

**Status**: Draft

**Depends on**: `specs/124-feature-requests/` (the GitHub client, Issue text quoting, the public notice), `specs/116-toggles/` (Toggles), `specs/168-settings-categories/` (the Features page in Settings)

**ADRs**: [0003](../../docs/adr/0003-trunk-based-with-gated-deploys.md) (migrations ship first), [0007](../../docs/adr/0007-spec-driven-pull-requests-gated-by-risk.md) (the workflow a Bug enters), [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (Toggles)

**Input**: Feature description: Feature #192. A separate Bug report flow, outside Feature Requests, that any signed-in User can start from inside the app. On sending, the app attaches the User's Toggles and device information to a Bug Issue without the User typing them. The repo is public, so the form says the report is posted publicly and the Requested by field stays an opaque reference.

**Behind Toggle**: `feature-192`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Report a bug, with the Toggles attached (Priority: P1)

In **Settings → Features**, a User taps **Report a bug**. A short form asks what went wrong (required), what they expected, how it happened (both optional), where in the app it was (Today, Foods, Summary, Settings or Somewhere else) and how bad it is (**I can't finish what I was doing** or **It's annoying, but I can work around it**). A line says the report is posted publicly on GitHub, and a hint says that a problem with a feature they are trying should go in **Give feedback** on its request instead. Under **Attached to your report** the form shows exactly what the app adds: every Toggle that is on for them, with its state, and the app version. Sending creates a Bug Issue with the Bug template's headings that the Dispatcher triages, and the form says **Sent** with a link to the Issue.

**Why this priority**: it is the Feature; a report that reaches GitHub with the Toggles already attached is most of the value.

**Independent Test**: Vitest proves the Bug Issue's headings, quoting and limits and the action's checks and undo; pgTAP proves Bug reports are private and capped; Testing Library proves the form; Playwright sends a report through the fake GitHub client.

**Acceptance Scenarios**:

1. **Given** the `feature-192` Toggle is on for a User, **When** they open Settings → Features, **Then** a **Report a bug** row leads to the form at `/settings/report-a-bug`.
2. **Given** the Toggle is off for a User, **When** they open Settings → Features or go to `/settings/report-a-bug` directly, **Then** there is no row, the page is not found, and the server action answers `not_found`.
3. **Given** the form, **When** the User sends with What went wrong empty or shorter than 10 characters, or with no How bad is it chosen, **Then** nothing is sent and each field says what it needs.
4. **Given** the form, **When** it is shown, **Then** it says the report is posted publicly on GitHub, and that feedback on a feature they are trying goes in Give feedback on its request.
5. **Given** a User with Toggles on (some in Testing, some Live), **When** they look at **Attached to your report**, **Then** it lists each Toggle that is on for them, by title and key, with **Testing** or **Live**, Testing first, and the app version; a User with none on sees "No Toggles on".
6. **Given** a valid form, **When** the User sends it, **Then** a Bug Issue is created titled `Bug: ` and the start of What went wrong, with the headings `### Steps to reproduce`, `### Expected`, `### Actual`, `### Device`, `### Toggles`, `### How bad is it`, `### Requested by` (the Bug report's id) and `### Risk assessment` (every box unticked), and the labels `bug` and `needs-triage`. `### Steps to reproduce` starts with "Where in the app:" and the screen chosen; `### How bad is it` holds the Bug template's option text for the choice (P1 or P2); an optional field left empty reads `_Not given_`.
7. **Given** the User's text contains `#` headings, `@` mentions or `#123` references, **When** the Issue is created, **Then** each field is quoted so it cannot add headings, no mention notifies anyone, and no reference links to another Issue (as spec 124 US1.6).
8. **Given** a sent report, **When** the form updates, **Then** it says **Sent** with a link to the Bug Issue, and its fields are cleared.
9. **Given** the User has sent 5 Bug reports in the last 24 hours, **When** they open the form, **Then** it says they can send 5 a day and cannot be sent; the server refuses a sixth with `limit`.
10. **Given** GitHub refuses or cannot be reached, **When** the User sends, **Then** no Bug report is kept, a message says it couldn't be sent and to try again, and what they typed stays in the form.
11. **Given** another User, **When** they read or change Bug reports, **Then** they never see or change this User's.
12. **Given** the Bug template and `/deliver`'s `bug.md`, **When** an agent triages an in-app Bug, **Then** both know the `### Toggles` and `### Requested by` headings, and `bug.md` says to reproduce with the listed Toggles on.

---

### User Story 2 - Device information attached (Priority: P2)

The form's **Attached to your report** also lists the device: the phone model where the browser gives it, the operating system and its version, the browser and its version, whether the app is installed or open in a browser tab, the screen size, the Appearance, and the time zone. Sending adds them under `### Device`, so the owner never has to ask what phone it was.

**Why this priority**: it saves a round of questions for most Bugs, but a report reaches triage without it.

**Independent Test**: Vitest proves the device description from sample browser answers and that the server keeps only known fields, capped and quoted; Testing Library proves the preview; Playwright (Pixel 7) sees Android and Chrome in the preview and sends the report.

**Acceptance Scenarios**:

1. **Given** a browser that offers User-Agent Client Hints, **When** the form opens, **Then** **Attached to your report** shows the model, operating system and version, and browser and version from them.
2. **Given** a browser without Client Hints (Safari, Firefox), **When** the form opens, **Then** the same lines come from the user-agent string, and a value it cannot tell reads "Unknown".
3. **Given** the app opened from the home screen, **When** the form opens, **Then** it says **Installed app**; in a tab, **Browser tab**.
4. **Given** a sent report, **When** the Issue is created, **Then** `### Device` lists the app version, model, operating system, browser, installed app or browser tab, screen size in CSS pixels with the pixel ratio, Appearance and time zone, each as shown in the preview.
5. **Given** the server receives device information with unknown keys, values longer than 100 characters or non-text values, **When** it builds the Issue, **Then** it drops the unknown keys, cuts the long values, ignores the wrong types, and still sends the report.
6. **Given** device information is missing altogether (a tab open on the Slice 1 form), **When** the report is sent, **Then** `### Device` holds the app version only.

### Edge Cases

- **Offline**: the form keeps what was typed and says it couldn't be sent (US1.10).
- **The Issue is created but the app can't record it**: the Issue is closed again as not planned with a comment, and the User is asked to try again, so no orphan Bug is triaged (as spec 124).
- **Two sends at once** at 4 reports today: a per-User lock in the database lets only one through, so the limit of 5 holds.
- **A bug in a feature the User is trying**: the hint points to Give feedback; if they send a Bug report anyway, `### Toggles` shows the Testing Toggle, so triage can see it and, if it is a Round's work, say so on the Issue.
- **The Toggles cannot be read** (database error): the report is still sent, and `### Toggles` says "Couldn't be read".
- **Very long text**: What went wrong and What you expected are capped at 2,000 characters and How it happened at 4,000, counted after trimming, as the form shows.
- **The User loses access** (their Allowed Email removed): the Bug Issues stay on GitHub; their rows stay until the account is deleted.
- **Owner**: reports like anyone else; their Testing Toggles are listed like anyone's.
- **Nothing personal**: the report never includes the User's name, email, Foods, Entries or Goal; only what the preview shows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Everything in this spec MUST be off unless the `feature-192` Toggle is on for the User; its row is hidden, its page answers 404, and its server action refuses with `not_found` while off.
- **FR-002**: A User MUST be able to send a Bug report with a required What went wrong (10–2,000 characters after trimming), optional What you expected (up to 2,000) and How it happened (up to 4,000), a required How bad is it (`blocked` or `annoying`), and an optional screen (`today`, `foods`, `summary`, `settings`, `other`).
- **FR-003**: Sending MUST create a Bug Issue on `streetlampsalad/calories-counter` from the server only, with the headings of US1.6 in that order, each User-written field quoted and neutralised as in spec 124, `### Requested by` set to the Bug report's id, and labels `bug` and `needs-triage` only; the app sets no priority label.
- **FR-004**: The server MUST work out the Toggles that are on for the User itself (never trust the browser's list) and list them under `### Toggles`, Testing first.
- **FR-005**: A User MUST be able to send at most 5 Bug reports in any 24 hours.
- **FR-006**: A User MUST be able to read only their own Bug reports, and nobody MUST be able to write them except the server.
- **FR-007**: The form MUST show, before sending, the Toggles, app version and device the app will attach; the Issue MUST hold nothing else beyond what the User typed or chose, the Bug report's id and the template's headings and checklist.
- **FR-008**: The browser MUST describe the device as in US2.4; the server MUST keep only those fields, each text of at most 100 characters, quoted.
- **FR-009**: The Bug template (`.github/ISSUE_TEMPLATE/3-bug.yml`) and `.claude/skills/deliver/bug.md` MUST know the `### Toggles` and `### Requested by` headings, so a Bug filed on GitHub and one sent from the app read the same.

### Key Entities

- **Bug report**: what a User tells the Owner is broken, sent from inside the app: its Bug Issue number, who sent it and when. The words, Toggles and device live only in the public Bug Issue.
- **Toggle**: from spec 116; the ones on for the User are attached.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A User can send a Bug report in under a minute, typing only what went wrong.
- **SC-002**: 100% of in-app Bug Issues show the User's Toggles, and (after Slice 2) their phone's operating system and browser, without the Owner asking.
- **SC-003**: No in-app Bug Issue contains a User's name or email.

## Out of Scope

- Screenshots or screen recordings (D4).
- Following a Bug report's progress in the app, or a notification when it is fixed (D9).
- Choosing P0, or setting the priority label (D6).
- Turning a Bug report into a Round, or a Round's Bug set into a Bug Issue (spec 193 D2).
- An entry point outside Settings, such as a shake gesture or a button on every screen (D3).

## Ready to try

You'll find **Report a bug** in **Settings → Features**. Say what went wrong, and if you can, what you expected and how it happened; pick where in the app it was and how bad it is, and send it. The report shows which features you have turned on and what phone and browser you're using, so you don't have to; you can see exactly what's attached before you send it.

Guesses made: up to 5 reports a day; no screenshots; the report is posted publicly without your name; you pick the screen yourself rather than the app guessing it.

## Assumptions

- The repo stays public, so the report is published; the form says so before the User types, and the Issue holds no name or email.
- The fine-grained token from spec 124 (`GITHUB_FEATURE_REQUESTS_TOKEN`, Issues read and write on this repo) may also create Bug Issues; it is the same permission.
- Issues the token creates are authored by the Owner's account, so `/deliver next` treats an in-app Bug as from an allowed author, as it does in-app Feature Requests.
- Toggle keys and titles are already public (they are in the migrations), but which Testing Toggles are on for a User is not: a Testing Toggle is on only for its Requester and the Owner, so a report listing one hints at who sent it. The preview shows the list before sending, and among a few friends who already know each other's requests this is accepted (D14).
- 5 reports a day is far more than a few friends need and stops a stuck finger or a script from filling the repo with Issues.
- The app version is the short commit the deploy passes in (`COMMIT_SHA`), as Settings' About already shows.

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | Which device fields are safe to post publicly? | App version, model (where Client Hints give it), operating system and version, browser and its major version only, installed app or browser tab, screen size in CSS pixels and pixel ratio, Appearance, time zone. Each is shown in the preview first | The raw user-agent string, or the full browser version (adds fingerprinting detail for no triage gain); language and locale (says little the time zone doesn't); IP or network (personal) | medium |
| D2 | Does the app attach the current screen or route? | No; the User picks Today, Foods, Summary, Settings or Somewhere else, which opens `### Steps to reproduce` | The route (the form lives in Settings, so it would always say Settings); the previous page from history (unreliable after a reload, and paths hold Food ids) | high |
| D3 | Where is the entry point? | A **Report a bug** row in Settings → Features, next to Feature requests | A button on every screen or a shake gesture (clutters the thumb zone, more to build); inside Feature requests (keeps Bugs and Feature Requests muddled, which the Feature asks to avoid) | high |
| D4 | Can a screenshot be attached? | No | Uploading an image (GitHub's Issue API cannot attach files, so it needs storage and a public link; a screenshot can show a User's Foods, Goal or email, published) | high |
| D5 | Is it behind its own Toggle? | Yes, `feature-192`, added in Testing by Slice 1 (ADR 0008) | Shipping it Live straight away (ADR 0008 forbids it) | high |
| D6 | Who sets the severity? | The User picks one of two plain choices, written into `### How bad is it` as the Bug template's P1 or P2 option text; triage (`bug.md`) sets the label as for any Bug. P0 is not offered | The User choosing P0 (it means production is broken for everyone, which one User can't judge, and it jumps every queue); no choice at all (triage would have to guess) | medium |
| D7 | What lands on GitHub? | A Bug Issue with the Bug template's headings plus `### Toggles` and `### Requested by`, added to the template, labels `bug` and `needs-triage`; never `feature`, so the Feature Request sync never sees it | A Feature Issue (would enter the Feature Request flow and its limit of 2); extra headings only in API-made Issues (Bugs filed two ways would read differently, and triage would not know them) | high |
| D8 | How is it kept apart from a Round? | It is a separate flow with its own Issue type, and the form's hint sends feedback on a feature being tried to Give feedback; nothing links a Bug report to a Feature Request | Offering a choice of request inside the Bug form (duplicates Give feedback); refusing reports while a Testing Toggle is on (the bug may be elsewhere) | medium |
| D9 | Does the app show a User's past Bug reports or their progress? | No; after sending, the form links to the Issue | A list with stages (needs a second sync like spec 124's, for a rare flow) | medium |
| D10 | Is there a per-User limit? | 5 in any 24 hours, enforced in the database with a per-User advisory lock, as spec 124's limit is | No limit (the token is the Owner's, so a loop or a stuck button posts Issues in their name); 1 a day (real testing finds several) | medium |
| D11 | What does the app store? | A `bug_reports` row: id, User, Bug Issue number, created. Not the text, Toggles or device | Storing the text too (a second copy of what's on GitHub, kept for nothing) | high |
| D12 | Who writes `bug_reports`? | Only the server with the service role; Users read their own through RLS | User inserts under RLS (they could set any Issue number or dodge the limit's lock order) | high |
| D13 | Where do the Toggles come from? | The server calls `my_toggles` with the User's session when sending; the preview uses the same query in the browser | Taking the browser's list (could be edited to list anything) | high |
| D14 | Which Toggles are listed? | Every Toggle on for the User, Testing first, then Live, each with title, key and state; off ones are left out. A Testing Toggle hints at who sent the report (only its Requester and the Owner have it on); the preview shows it first, and it is the detail triage most needs | Only Testing ones (a Live feature's bug is just as likely); every Toggle with on or off (noise); leaving Testing Toggles out (hides the likeliest cause) | medium |
| D15 | Is any code shared with Feature Requests? | The GitHub client (`createFeatureIssues`, with `FEATURE_ISSUES=fake` in local and CI) and the quoting helpers, which move to `src/lib/issue-text.ts` unchanged | A second client and token (more secrets for the same permission) | high |
| D16 | Does the Issue body's text come from the browser? | Only the User's fields, the screen, the severity and the device; the server builds every heading, the Toggles, the version and the id | Building the body in the browser (anyone could post any body with the Owner's token) | high |
| D17 | Can a User's words steer the agent that fixes the Bug? | No: `bug.md` treats an in-app Bug's quoted sections as data describing the bug, never instructions; a report that asks to skip a step, lower the risk or change a guardrail gets `needs-human-review` (the deliver skill's existing rule). Bug fixes keep the normal merge gate, which flags guardrail files, migrations and dependencies on its own | Human review for every in-app Bug fix (slows every small fix for a few trusted friends); no in-app Bugs (the Feature) | medium |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | No | Reuses spec 124's GitHub token and `FEATURE_ISSUES=fake`; Issues: read and write already covers Bug Issues | |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | No | One new table and a Toggle row; nothing dropped | |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | Yes | GitHub is faked in CI, and real phones' Client Hints can't be; the Owner sends one real report from their phone and checks the Issue | 1, 2 |
| Touches sign-in, RLS policies or what one User can see of another | Yes | A new table with an RLS policy; a User's words, Testing Toggles (which hint at who they are, D14) and device are published on GitHub | 1, 2 |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | Yes | The Bug template and `/deliver`'s `bug.md` gain `### Toggles` and `### Requested by`; any Allowed User can now open a Bug Issue that the Dispatcher takes straight to a fix, so `bug.md` must read its quoted text as data only (D17) | 1 |
| Contradicts an ADR or needs a new one | No | Uses ADRs 0003, 0007 and 0008 as they are | |
| Size L or XL | No | Size M: a table, a form, a server action, an Issue body, a device description and a template change | |

**Size**: M

**Human review**: Needed for the spec and Slices 1 and 2
