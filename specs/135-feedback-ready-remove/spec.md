# Feature Specification: Feedback, Ready and Remove for Feature Requests

**Spec issue**: #135

**Feature**: #115

**Created**: 2026-11-08

**Status**: Draft

**Depends on**: `specs/124-feature-requests/` (Feature Requests, the sync, notifications, the Requester's switch), `specs/116-toggles/` (Toggles)

**ADRs**: [0005](../../docs/adr/0005-reminders-by-web-push-scheduled-from-the-database.md) (Web Push), [0007](../../docs/adr/0007-spec-driven-pull-requests-gated-by-risk.md) (the workflow), [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (Toggles go Live or Removed, then a Chore)

**Input**: Feature description: Feature #115. Once a Requester is trying their feature, they can ask for changes (another Round, behind the same Toggle), release it to everyone, or get rid of it; after 14 days they get one reminder to decide.

**Behind Toggle**: `feature-114` (this extends Feature Requests, so it adds no Toggle of its own)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Give feedback, and get another Round (Priority: P1)

On a request that is **Ready to try**, while its Toggle is in Testing, the Requester taps **Give feedback**. A sheet asks what should change, with the same note that it is posted publicly on GitHub. Sending it creates a follow-up Feature Issue behind the same Toggle, and the card goes back to **Submitted** and follows the new Round through its stages. The card lists each Round. While the new Round is built, the Requester can still try what was built before.

**Why this priority**: iterating is the point of trying a feature before everyone gets it.

**Independent Test**: Vitest proves the follow-up Issue's headings, the action's checks, and that Withdraw is refused once a request has been Ready to try; pgTAP proves Rounds are private, the sync follows the newest Round, and the Requester keeps their switch during a Round; Playwright sends feedback and sees Submitted with the Round listed.

**Acceptance Scenarios**:

1. **Given** a request at Ready to try with its Toggle in Testing, **When** the Requester opens its card, **Then** it offers **Give feedback**, **It's ready** and **Remove it**.
2. **Given** the Give feedback sheet, **When** the Requester sends fewer than 10 characters, **Then** it is not sent and says what it needs.
3. **Given** valid feedback, **When** it is sent, **Then** a Feature Issue is created with the Feature template's headings, the feedback quoted as `### Problem`, the original goal quoted as `### Desired outcome`, `### Follow-up to` naming the original Feature Issue, `### Requested by` holding the same request id, and labels `feature`, `needs-triage` and `priority:P1`; the card shows **Submitted** and lists the Round.
4. **Given** a follow-up Round on GitHub, **When** the sync runs, **Then** the card follows the newest Round's stage, and an older Round's Issue no longer changes it.
5. **Given** a Round reaches Ready to try, **When** the sync arrives, **Then** the Requester is notified again, as for the first.
6. **Given** a Round is being built, **When** the Requester asks about the Toggle, **Then** they can still switch it, because the request was Ready to try before.
7. **Given** the Requester already has 2 other requests that agents are working on, **When** they open Give feedback, **Then** it says they can have 2 at a time and cannot be sent.
8. **Given** a request whose Toggle is Live or Removed, or that is not at Ready to try, **When** its card is shown, **Then** it offers none of Give feedback, It's ready or Remove it.
9. **Given** `/deliver` triages a Feature with `### Follow-up to #<n>`, **When** it writes the spec, **Then** the spec changes the feature behind the existing Toggle `feature-<n>` and adds no new Toggle.
10. **Given** another User, **When** they read Rounds, **Then** they see none of this Requester's Rounds.
11. **Given** a request that has been Ready to try and is back at Submitted, Being reviewed or Planning for a Round, **When** its card is shown or the Requester asks to withdraw it, **Then** Withdraw is not offered and the server refuses it, because a built feature is in production behind its Toggle and only It's ready or Remove it may end it.

---

### User Story 2 - Mark it ready (Priority: P2)

The Requester taps **It's ready** and confirms. The feature turns on for every User at once, the card says **Live for everyone**, and a Chore Issue is created to delete the Toggle's checks from the code.

**Why this priority**: it is how a feature gets to everyone.

**Independent Test**: Vitest proves the order (Chore first, then Live, and the Chore closed again if Live fails) and the checks; pgTAP proves a Toggle cannot go Live twice; Playwright marks a request ready and sees Live for everyone.

**Acceptance Scenarios**:

1. **Given** a request at Ready to try with its Toggle in Testing, **When** the Requester confirms It's ready, **Then** a Chore Issue "Remove the Toggle for #<n>" is created `ready-for-agent`, the Toggle goes Live, and the card shows **Live for everyone**.
2. **Given** the Chore cannot be created, **When** the Requester confirms, **Then** nothing changes and a message says to try again.
3. **Given** the Chore was created but the Toggle cannot go Live (it is no longer in Testing), **When** the action finishes, **Then** the Chore is closed again as not planned and the card says it couldn't be done.
4. **Given** the confirm sheet, **When** the Requester taps Keep testing, **Then** nothing changes.

---

### User Story 3 - Remove it (Priority: P3)

The Requester taps **Remove it** and confirms. The feature turns off for everyone, the Requester too, the card says **Removed**, and a Chore Issue is created to delete the feature's code.

**Why this priority**: the way out when the feature isn't worth keeping.

**Independent Test**: as User Story 2, with Removed.

**Acceptance Scenarios**:

1. **Given** a request at Ready to try with its Toggle in Testing, **When** the Requester confirms Remove it, **Then** a Chore Issue "Remove the feature for #<n>" is created `ready-for-agent`, the Toggle goes Removed, and the card shows **Removed**.
2. **Given** the removal Chore, **When** an agent delivers it, **Then** it deletes the feature's code, and any table the feature added is dropped in that Chore's migration (which the merge gate flags for Human review).
3. **Given** the Chore cannot be created, or the Toggle cannot be Removed, **When** the Requester confirms, **Then** it behaves as US2.2 and US2.3.

---

### User Story 4 - A reminder to decide (Priority: P4)

If a request has sat at **Ready to try** for 14 days with its Toggle still in Testing, the Requester gets one push notification asking them to mark it ready, give feedback or remove it. Nothing further is sent for that Round.

**Why this priority**: it stops Toggle checks living in the code for ever, but it's a nudge, not a gate.

**Independent Test**: pgTAP proves who is due and that each is due once; Vitest proves the notification.

**Acceptance Scenarios**:

1. **Given** a request at Ready to try for 14 days with its Toggle in Testing, **When** the sync runs, **Then** each of the Requester's devices gets "Still trying: <title>?", opening the request.
2. **Given** that reminder was sent, **When** the sync runs again, **Then** nothing more is sent for that Round.
3. **Given** a request that reached Ready to try less than 14 days ago, or whose Toggle is Live or Removed, or that is withdrawn, **When** the sync runs, **Then** no reminder is sent.

### Edge Cases

- **Feedback while a Round is already in progress**: not offered; the card offers it again once the Round is Ready to try.
- **A Round that agents decline** (Not going ahead): the request was Ready to try before, so the card keeps the switch and still offers Give feedback, It's ready and Remove it, with the reason (D13).
- **Withdraw during a Round**: not offered, and refused by the server (US1.11, D12). Withdrawing would close only the original Issues, leave the Round's Issue open, end the Requester's switch, and leave the Toggle in Testing with nobody to decide; the Requester waits for the Round's Ready to try and chooses Remove it instead.
- **The original Feature or Spec Issue changes after a Round starts**: ignored, because the request follows its newest Round.
- **It's ready and Remove it at once** (two phones): the Toggle can only leave Testing once, so the second finds it no longer in Testing, closes its Chore again and says so.
- **The Owner's own requests**: work the same; the Owner may also still switch any Toggle in Testing.
- **Offline**: every action says it couldn't be done and changes nothing.
- **A feature with tables, removed**: the Chore's migration drops them, which needs the Owner's review; until it merges, the tables stay, unused.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Give feedback, It's ready and Remove it MUST be offered only to the Requester, only at Ready to try (or Not going ahead after a declined Round, D13), only while the request's Toggle is in Testing, and only while `feature-114` is on for them; the server actions MUST check the same.
- **FR-002**: Feedback MUST be 10–4,000 characters and MUST create a follow-up Feature Issue (FR-003 of spec 124's quoting and neutralising apply) with `### Follow-up to #<original Feature Issue>`, labelled `priority:P1`.
- **FR-003**: A request MUST follow the stage of its newest Feature Issue, and MUST be notified at Ready to try for every Round.
- **FR-004**: A Requester MUST keep their switch while a Round is in progress once the request has been Ready to try.
- **FR-005**: Feedback MUST count towards the limit of 2 open requests.
- **FR-006**: It's ready MUST create the Toggle-removal Chore and then set the Toggle Live; Remove it MUST create the feature-removal Chore and then set the Toggle Removed; either MUST close its Chore again if the Toggle is no longer in Testing.
- **FR-007**: One reminder MUST be sent per Round that stays Ready to try, with its Toggle in Testing, for 14 days.
- **FR-008**: The Feature template, `triage.md` and `/deliver`'s `spec.md` MUST know `### Follow-up to` and reuse the original Toggle.
- **FR-009**: Withdraw MUST NOT be offered, and the server MUST refuse it, once a request has been Ready to try (`first_ready_at` set).

### Key Entities

- **Round**: one follow-up of a Feature Request: the feedback and its Feature Issue. The first Round is the request itself.
- **Decision**: It's ready or Remove it, with its Chore Issue.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Requester can send feedback, mark ready or remove from the card in under 30 seconds.
- **SC-002**: After It's ready, every User has the feature on their next screen that asks (within a minute of cached data).
- **SC-003**: No Toggle stays in Testing with no decision and no reminder for more than 14 days.

## Out of Scope

- Changing a feature that is already Live (that is a new Feature Request).
- Bringing back a Removed feature.
- Other Users giving feedback on someone else's request.
- Undoing It's ready.

## Ready to try

On a feature you're trying, open **Settings → Feature requests**. Under it you'll find **Give feedback** to ask for changes, **It's ready** to turn it on for everyone, and **Remove it** to get rid of it. Feedback starts another Round, which the card follows just like the first, and you can keep trying the current version meanwhile.

Guesses made: only you, the one who asked, can decide; It's ready can't be undone; you get one reminder after 14 days of trying.

## Assumptions

- The Requester alone decides It's ready for everyone, as the owner decided on 2026-11-08 (grilling, Q5).
- A Round's Feature Issue uses the request's own id under `### Requested by`, so the sync needs no new link; the newest Issue number is the current Round.
- The board's nightly run is enough to send 14-day reminders on time to within a day.
- Removing a Live feature, or undoing a decision, is a job for the Owner on GitHub, not the app.

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | How does a Round link to its request? | Its Feature Issue's `### Requested by` holds the request id; Rounds are rows in `feature_request_rounds`; the sync sends only the newest Feature Issue per request | A new `### Round of` heading the sync parses (a second link to keep in step) | high |
| D2 | Does a Round get its own Toggle? | No: it changes the feature behind `feature-<original Feature Issue>` | A Toggle per Round (several half-features, and the switch moves) | high |
| D3 | Can the Requester try it while the next Round is built? | Yes: `can_try_toggle` accepts a request that has been Ready to try at least once (`first_ready_at`) | Only at Ready to try (they lose what they were testing) | high |
| D4 | In what order do It's ready and Remove it happen? | Chore first, then the Toggle's state; the Chore is closed again if the state change finds the Toggle no longer in Testing | State first (a Live Toggle with no Chore leaves dead checks for ever, and state cannot go back) | high |
| D5 | Who decides It's ready? | The Requester alone | The Owner approving too (the owner chose the Requester, Q5) | high |
| D6 | Who sends the 14-day reminder, and when? | The sync route, on the board's runs (every event and nightly), through `due_testing_reminders()`, which marks each Round's reminder as sent in the same update | A new pg_cron job (another schedule to set up per environment) | medium |
| D7 | Is a reminder per Round or per request? | Per Round: each Ready to try can be reminded once | Once ever (a second Round would never be nudged) | medium |
| D8 | Are actions allowed during a Round? | No: Give feedback, It's ready and Remove it only at Ready to try | Allowing Remove it any time (could remove code mid-Round, leaving its pull requests stranded) | medium |
| D9 | What does a follow-up Issue say? | `### Problem` is the feedback, `### Desired outcome` the original goal, `### Additional details` "Round <n> of #<original>", and `### Follow-up to #<original>` | Only the feedback (triage would lose what the feature is for) | high |
| D10 | Who may change a Toggle's state? | The server, with the service role, after checking the Requester; Users still have no write access to `toggles` | A definer function Users call (more surface for one check the server already does) | high |
| D11 | Do the clean-up Chores delete the Toggle's row? | No: the row stays, Live or Removed, because a Feature Request's card reads it to show Live for everyone or Removed; only the code checks go | Deleting it (the card would fall back to Ready to try) | high |
| D12 | Can a Requester withdraw during a Round? | No: Withdraw is only for a request that has never been Ready to try; afterwards the way out is Remove it, at the Round's Ready to try | Withdrawing the Round (closing its Issues and going back to Ready to try: another state to sync) or the whole request (closes only the original Issues and leaves the Toggle in Testing for ever) | high |
| D13 | What if agents decline a Round? | The request shows Not going ahead with the reason, but, having been Ready to try, keeps its switch and still offers the three actions | Leaving it stuck (its Toggle would stay in Testing with no way to decide) or putting it back at Ready to try (a misleading Ready to try notification) | medium |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | No | Reuses the GitHub token, the sync secret and the push keys from spec 124 | |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | Yes | It's ready and Remove it change the app for every User and cannot be undone from the app; a removal Chore drops tables (its own pull request is flagged by the merge gate) | 2, 3 |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | No | GitHub and push are faked as in spec 124; the real ones are already checked | |
| Touches sign-in, RLS policies or what one User can see of another | Yes | A new table's RLS; `can_try_toggle` changes; a Requester changes what every User sees | 1, 2, 3 |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | Yes | The Feature template, `triage.md` and `/deliver`'s `spec.md` | 1 |
| Contradicts an ADR or needs a new one | No | Follows ADR 0008's Live and Removed, each followed by a Chore | |
| Size L or XL | Yes | Size L: a table, three functions changed, three actions, three sheets, the sync and a reminder | all |

**Size**: L

**Human review**: Needed for the spec and Slices 1, 2 and 3
