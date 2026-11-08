# Feature Specification: Feature Requests from inside the app

**Spec issue**: #124

**Feature**: #114

**Created**: 2026-11-08

**Status**: Draft

**Depends on**: `specs/116-toggles/` (Toggles, the Owner), `docs/specs/016-daily-reminder.md` (Web Push), `docs/specs/009-settings-and-goal.md` (Settings)

**ADRs**: [0005](../../docs/adr/0005-reminders-by-web-push-scheduled-from-the-database.md) (Web Push), [0007](../../docs/adr/0007-spec-driven-pull-requests-gated-by-risk.md) (the workflow a Feature Request enters), [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (Toggles)

**Input**: Feature description: Feature #114. A User who wants the app to do something new can ask from inside it, follow what happens, get a notification when it is ready to try, and try it with their own switch.

**Behind Toggle**: `feature-114`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask for a feature (Priority: P1)

From Settings, a User opens **Feature requests** and taps **Request a feature** at the bottom. A short form asks what they would like to be able to do (required), what's getting in the way today and anything else (both optional). Hint text with examples encourages detail, and a line says the request is posted publicly on GitHub. While permission is undecided, the form offers to turn on notifications so the User hears when the feature is ready, and submits whatever they choose. Submitting creates a Feature Issue that the Dispatcher picks up, and the request appears at the top of their list as **Submitted**, with how many requests are ahead of it.

**Why this priority**: it is the feature; everything else follows a request that exists.

**Independent Test**: Playwright submits a request through a fake GitHub client and sees it listed; Vitest proves the Issue body's headings, escaping and limits; pgTAP proves the requests are private and capped.

**Acceptance Scenarios**:

1. **Given** the `feature-114` Toggle is on for a User, **When** they open Settings, **Then** a **Feature requests** row leads to their list, with **Request a feature** at the bottom of the screen.
2. **Given** the Toggle is off for a User, **When** they open Settings or go to `/settings/feature-requests` directly, **Then** there is no row and the page is not found.
3. **Given** the form, **When** the User submits with the first field empty or shorter than 10 characters, **Then** it is not sent and the field says what it needs.
4. **Given** the User has typed fewer than 100 characters in total, **When** they look at the form, **Then** a gentle line under the fields says more detail means a closer result; it never blocks submitting.
5. **Given** a valid form, **When** the User submits, **Then** a Feature Issue is created with the headings `### Problem`, `### Who has it` ("The requester"), `### Desired outcome`, `### Additional details` and `### Requested by` (the Feature Request's id), labels `feature`, `needs-triage` and `priority:P2`, and the request shows as **Submitted** at the top of the list.
6. **Given** the User's text contains `#` headings, `@` mentions or `#123` references, **When** the Issue is created, **Then** each field is quoted so it cannot add headings, no mention notifies anyone, and no reference links to another Issue.
7. **Given** the User already has 2 requests that agents are still working on, **When** they open the form, **Then** it says they can have 2 at a time and cannot be submitted.
8. **Given** notification permission is not yet decided and push is supported, **When** the form opens, **Then** it offers "Notify me when it's ready", which asks for permission and subscribes this device; declining still lets them submit.
9. **Given** GitHub refuses or cannot be reached, **When** the User submits, **Then** no request is kept and a message says it couldn't be sent and to try again, with what they typed still in the form.
10. **Given** another User, **When** they read or change Feature Requests, **Then** they never see or change this User's request except as US2.4 allows.

---

### User Story 2 - Follow a request through its stages (Priority: P2)

Each request in the list shows its stage in plain words, **Submitted → Being reviewed → Planning → Building → Ready to try → Live for everyone**, or a side state, **Waiting for the owner**, **Not going ahead** (with the reason) or **Removed**, plus the latest agent comment in one line and a link to the Issue. The stage follows the Feature Issue on GitHub: every Issue and pull request event runs a sync that works out each request's stage and sends it to the app.

**Why this priority**: without it a request disappears into GitHub.

**Independent Test**: Vitest proves the stage rules on Issue trees; the sync route's handler is tested with a fake store; Playwright posts a sync and sees the card change.

**Acceptance Scenarios**:

1. **Given** a Feature Issue at each point of the workflow, **When** the stage is worked out, **Then** it is: Submitted (labelled `needs-triage` and unassigned); Being reviewed (being triaged); Planning (has a Spec Issue, no Slices yet); Building (its Spec has Slices, not all in production); Ready to try (the Feature or its Spec is closed as completed); Waiting for the owner (`needs-human-review` on the Feature, its Spec, an open Slice, or an open pull request referring to one of them); Not going ahead (the Feature closed as not planned).
2. **Given** a request's Toggle is Live or Removed, **When** the list shows it, **Then** it says **Live for everyone** or **Removed**, whatever GitHub says.
3. **Given** a sync with the wrong or no secret, **When** it reaches the app, **Then** it is refused and nothing changes.
4. **Given** other Users' requests that agents are working on or that are Ready to try, **When** a User opens their list, **Then** they also see those requests read-only (what was asked and the stage, never who asked), so they don't ask twice.
5. **Given** a request that is Not going ahead, **When** it is shown, **Then** the card gives the reason from the latest comment.
6. **Given** the list is loading, empty, or fails to load, **When** it is shown, **Then** it shows a placeholder, a line inviting a first request, or a message with Retry.

---

### User Story 3 - Hear it's ready, and try it (Priority: P3)

When a request reaches **Ready to try**, the requester gets a push notification that opens the request. Its card shows a short note from the agent on what was built, how to try it and what it guessed, and a switch that turns the feature on for the requester alone. A request that is **Not going ahead** also notifies, with the reason.

**Why this priority**: the point of the journey is trying the result.

**Independent Test**: Vitest proves which stage changes notify; pgTAP proves the requester, and only the requester (and the Owner), can switch their Feature's Toggle; Playwright syncs a request to Ready to try and turns its switch on.

**Acceptance Scenarios**:

1. **Given** a request moves to Ready to try, **When** the sync arrives, **Then** each of the requester's subscribed devices gets "Ready to try: <title>", opening `/settings/feature-requests#<id>`, exactly once.
2. **Given** a request moves to Not going ahead, **When** the sync arrives, **Then** the requester is notified with the start of the reason, once.
3. **Given** any other stage change, or the same stage again, **When** the sync arrives, **Then** nobody is notified.
4. **Given** a request at Ready to try whose spec has a `## Ready to try` section, **When** its card is shown, **Then** that note is on it.
5. **Given** a request at Ready to try and its Toggle in Testing, **When** the requester turns its switch on, **Then** the feature is on for them alone; other Users who are not the Owner cannot switch it, and nor can the requester before Ready to try.
6. **Given** a requester has withdrawn their request, **When** they ask about its Toggle, **Then** they can no longer switch it.
7. **Given** `/deliver` writes a spec for a Feature, **When** the spec is written, **Then** it has a `## Ready to try` section: what the User will find, how to try it and the assumptions made, in plain words for the User.

---

### User Story 4 - Withdraw a request (Priority: P4)

Before building starts, the requester can withdraw a request. After a confirm dialog, its Feature Issue (and Spec Issue, if any) is closed as not planned with a comment, and the card says **Withdrawn**. Once building has started, the only way out is to try it and remove it (Feature #115).

**Why this priority**: useful but rare.

**Independent Test**: Vitest proves when withdrawing is allowed; Playwright withdraws a Submitted request through the fake GitHub client.

**Acceptance Scenarios**:

1. **Given** a request at Submitted, Being reviewed or Planning, **When** the requester taps **Withdraw** and confirms, **Then** its Issues are closed as not planned with "Withdrawn by the requester." and the card shows **Withdrawn**.
2. **Given** a request at any other stage, **When** the card is shown, **Then** there is no Withdraw.
3. **Given** a withdrawn request, **When** a later sync says it is Not going ahead, **Then** it stays **Withdrawn** and nobody is notified.
4. **Given** a withdrawn request, **When** the requester counts their open requests, **Then** it does not count towards the 2.

### Edge Cases

- **No push support or permission denied**: the form says notifications aren't available here; the list is the way to check.
- **A request whose Issue was deleted or transferred**: the sync never mentions it again and it keeps its last stage.
- **A sync for a request the app doesn't know** (another environment's Issue): ignored.
- **Two syncs at once**: each sets an absolute stage, and a notification is sent only when the stored stage changes, inside one database update, so at most once.
- **Very long text**: each field is capped (goal 2,000 characters, the others 4,000) and counted as typed.
- **The User loses access** (their Allowed Email removed): their requests stay; nobody else's view changes.
- **Offline**: the form keeps what was typed and says it couldn't be sent.
- **Two submits at once** at 1 open request: a per-User lock in the database lets only one through, so the limit of 2 holds.
- **The Issue is created but the app can't record it**: the Issue is closed again with a comment and the User is asked to try again, so no orphan Issue is built.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Everything in this spec MUST be off unless the `feature-114` Toggle is on for the User; its pages answer 404 and its server actions refuse while off.
- **FR-002**: A User MUST be able to submit a Feature Request with a required goal (10–2,000 characters) and optional problem and details (up to 4,000 each).
- **FR-003**: Submitting MUST create a Feature Issue on `streetlampsalad/calories-counter` from the server only, with the Feature template's headings, each field quoted, mentions neutralised, `Requested by` set to the request's id, and labels `feature`, `needs-triage`, `priority:P2`.
- **FR-004**: A User MUST have at most 2 requests at Submitted, Being reviewed, Planning, Building or Waiting for the owner.
- **FR-005**: A User MUST see all their own requests, and other Users' requests from Submitted to Ready to try without who asked; nobody MUST be able to change another User's requests.
- **FR-006**: The app MUST store each request's stage as GitHub's workflow implies it (US2.1), updated by a sync that only a holder of the shared secret can call; Live and Removed come from the request's Toggle.
- **FR-007**: The requester MUST get one push notification on each device when their request reaches Ready to try or Not going ahead.
- **FR-008**: A requester MUST be able to switch their request's Toggle while it is in Testing, until they withdraw it.
- **FR-009**: A requester MUST be able to withdraw a request at Submitted, Being reviewed or Planning.
- **FR-010**: Every spec `/deliver` writes for a Feature MUST include a `## Ready to try` section, which the sync passes to the app.
- **FR-011**: The Feature template and `triage.md` MUST know the `### Additional details` heading.

### Key Entities

- **Feature Request**: what a User asked for (goal, problem, details), its Feature Issue, its stage, the latest comment, the Ready to try note, and when it was withdrawn.
- **Requester**: the User who submitted a Feature Request.
- **Toggle**: `feature-<Feature Issue number>`, from spec 116.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A User can submit a request in under a minute and see it listed as Submitted straight away.
- **SC-002**: Within a few minutes of any change on GitHub, the request's stage in the app matches it.
- **SC-003**: A requester hears about Ready to try without opening the app, on every device they subscribed.

## Out of Scope

- Feedback, Ready and Remove from the app (Feature #115).
- The requester answering an agent's questions in the app; questions go to the Owner.
- Editing a request after submitting it.
- Showing who asked for another User's request.
- Choosing a priority.

## Ready to try

You'll find **Feature requests** in Settings. Tap **Request a feature**, describe what you'd like the app to do, and send it. Your request appears in the list and moves through its stages as the agents work on it. When it says **Ready to try**, use its switch to turn the new feature on just for you.

Guesses made: requests are capped at 2 in progress per person; other people's requests show without names; you can withdraw only until building starts.

## Assumptions

- The repo stays public, so a request's text is published; the form says so before the User types.
- Stage changes reach the app within minutes, because `board.yml` runs on every Issue and pull request event and closing Issues with `AUTOMATION_TOKEN` triggers it again.
- `Requested by` holds the request's UUID, which identifies no one.
- Until Slice 2 deploys, nothing moves a request on from Submitted, so the cap of 2 holds a User at two requests; that is harmless while `feature-114` is only on for the Owner.
- The Feature Issue's title is "Feature: " and the start of the goal, cut to 70 characters at a word.
- "Requests ahead of yours" counts every User's requests at Submitted or Being reviewed created earlier; the Dispatcher also works on the Owner's own Issues, so it is a guide, not a promise.

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | Who writes Feature Request rows? | Only the server (service role) in server actions and the sync route; Users read through RLS | User inserts under RLS (they could set stage or Issue number) | high |
| D2 | How does the app create the Issue? | A fine-grained token limited to this repo with Issues: read and write, in `GITHUB_FEATURE_REQUESTS_TOKEN`, server only; a fake client when `FEATURE_ISSUES=fake` (local and CI) | A GitHub App (more setup for one call); `AUTOMATION_TOKEN` (classic, far wider scope) | high |
| D3 | How does the app learn stages? | A step in `board.yml` runs `scripts/workflow/feature-requests-sync.mjs`, which works out every request's stage and POSTs them to `/api/feature-requests/sync` with `FEATURE_REQUESTS_SYNC_SECRET` | A GitHub webhook (another secret and endpoint to configure per environment, same result); the app reading GitHub per view (rate limits, the token on every page) | high |
| D4 | Does `deploy.yml` need to change? | No: closing delivered Issues fires `issues: closed`, so `board.yml` runs the sync | A step in `deploy.yml` (two places to keep in step) | medium |
| D5 | Which stage while an Issue has `needs-human-review` on a pull request too? | Waiting for the owner wins over every stage except Ready to try and Not going ahead | Showing the underlying stage (the User would think it is moving) | high |
| D6 | Where does the Ready to try note come from? | A `## Ready to try` section the spec writer adds to every spec; the sync reads it from `main` | A comment the last Slice writes (nobody knows which Slice is last until it deploys) | medium |
| D7 | What counts as "open" for the cap of 2? | Stages where agents still work: Submitted, Being reviewed, Planning, Building, Waiting for the owner | Including Ready to try (a User testing two features could never ask again) | medium |
| D8 | When may a request be withdrawn? | Submitted, Being reviewed, Planning | Any time before Ready to try (would strand merged code behind a Toggle with no Chore); never | high |
| D9 | How is text kept from shaping the Issue? | Each field is a Markdown quote (`> ` on every line), and `@` before a word and `#` before a number get a zero-width space, so no mention notifies and no cross-reference lands on another Issue. Slash commands are left as text: no bot acts on them here, and `/deliver` reads every Issue as data | Free text (could add a fake `### Requested by`); a code block (hard to read) | high |
| D10 | Do other Users see who asked? | No; only what was asked and its stage, through a `security definer` function | Showing names (friends may not want it known); hiding others entirely (duplicates) | medium |
| D11 | Who can switch a request's Toggle? | The Owner, and its Requester once the request is at Ready to try and until it is withdrawn: `can_try_toggle` is replaced to add them | The Requester at any stage (they could switch on a half-built feature through the API); only the Requester (the Owner would lose the switch spec 116 gave them) | high |
| D12 | When do notifications send? | Only when the stored stage changes into Ready to try or Not going ahead, decided in one `update … returning` so a repeated sync cannot send twice | Notifying on every stage (noise) | high |
| D13 | Is the requester told of Waiting for the owner? | No notification; the card shows it | Notifying (the User can't act on it) | medium |
| D14 | What is this feature's own Toggle? | `feature-114`, added by Slice 1, so only the Owner sees it until it goes Live | A Toggle per Slice (one feature, one Toggle) | high |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | Yes | GitHub's API from the app with a new token; a new shared secret in Vercel and GitHub Actions; `FEATURE_ISSUES` in Playwright | 1, 2 |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | No | New table and functions; `can_try_toggle` is replaced but keeps the Owner's answer | |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | Yes | The real GitHub call and real push delivery are faked in CI; the Owner checks one real request end to end | 1, 3 |
| Touches sign-in, RLS policies or what one User can see of another | Yes | Users see others' requests (without names); the requester can switch a Toggle | 1, 2, 3 |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | Yes | `board.yml`, the Feature template, `/deliver`'s `triage.md` and `spec.md`, the spec template | 1, 2, 3 |
| Contradicts an ADR or needs a new one | No | Uses ADRs 0005, 0007 and 0008 as they are | |
| Size L or XL | Yes | Size L: a table, five functions, three screens, two server actions, a sync script, a route and notifications | all |

**Size**: L

**Human review**: Needed for the spec and Slices 1, 2 and 3
