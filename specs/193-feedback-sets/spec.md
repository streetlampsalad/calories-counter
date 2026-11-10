# Feature Specification: Several sets of feedback, each an enhancement or a bug

**Spec issue**: #193

**Feature**: #191

**Created**: 2026-11-10

**Status**: Draft

**Depends on**: `specs/135-feedback-ready-remove/` (Give feedback, Rounds), `specs/124-feature-requests/` (Feature Requests, the sync), `specs/116-toggles/` (Toggles)

**ADRs**: [0007](../../docs/adr/0007-spec-driven-pull-requests-gated-by-risk.md) (the workflow), [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (Toggles)

**Input**: Feature description: Feature #191. While trying a feature in Testing, a Requester can give several separate sets of feedback at once, each marked an enhancement or a bug, instead of one note per Round.

**Behind Toggle**: `feature-114` (a Round-level follow-up to Feature #115, so it adds no Toggle of its own; Feature #191 is `### Follow-up to #115`)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send several sets of feedback in one Round (Priority: P1)

On a request that is **Ready to try**, the Requester taps **Give feedback**. The sheet starts with one set: a text box and a choice of **Enhancement** or **Bug**. **Add another set** adds more (up to 5), and a set can be removed while more than one remains. Sending creates one follow-up Feature Issue whose Problem lists each set under its own heading naming its category, so triage sees which parts are defects and which are wishes. The Round, the card going back to **Submitted** and the 2-at-a-time limit work as in spec 135.

**Why this priority**: it is the whole Feature: real testing turns up several unrelated things at once.

**Independent Test**: Vitest proves the sets' checks, the Issue body and the action; pgTAP proves the sets are stored with the Round and stay private; Testing Library proves the sheet; Playwright sends one bug set and two enhancement sets.

**Acceptance Scenarios**:

1. **Given** the Give feedback sheet, **When** it opens, **Then** it shows one set with **Enhancement** chosen, an **Add another set** button, and no remove button.
2. **Given** a set, **When** the Requester chooses **Bug** or **Enhancement**, **Then** that set (and only that set) takes the category.
3. **Given** fewer than 5 sets, **When** the Requester taps Add another set, **Then** a new empty Enhancement set appears; **Given** 5 sets, **Then** Add another set is not offered.
4. **Given** more than one set, **When** the Requester removes one, **Then** the others keep their text and category.
5. **Given** any set with fewer than 10 characters, **When** the Requester sends, **Then** nothing is sent and the message says which set needs more.
6. **Given** one bug set and two enhancement sets, each valid, **When** they are sent, **Then** one Feature Issue is created with the Feature template's headings, `### Problem` holding each set quoted under its own heading ("Bug 1", "Enhancement 1", "Enhancement 2"), `### Additional details` reading "Round <n> of #<original>. 1 bug, 2 enhancements.", `### Follow-up to`, `### Requested by` and the labels as in spec 135; and the card shows **Submitted**.
7. **Given** the Requester already has 2 other requests agents are working on, **When** they open Give feedback, **Then** it says they can have 2 at a time and cannot be sent (as spec 135 US1.7).
8. **Given** the server receives no set, more than 5 sets, a set outside 10–4,000 characters, or a category other than enhancement or bug, **When** it is asked to send, **Then** it refuses with `invalid` and creates nothing.
9. **Given** the Issue cannot be created or recorded, **When** the Requester sends, **Then** the Round is undone as in spec 135, a message says to try again, and every set stays in the sheet.

---

### User Story 2 - See each set under the request (Priority: P2)

The request's card lists each Round, and under a Round each set with its category, so the Requester can see what they asked for and how it was labelled.

**Why this priority**: it confirms what was sent, but the feedback reaches triage without it.

**Independent Test**: Testing Library proves the list, including a Round from before this Feature; pgTAP proves another User sees none.

**Acceptance Scenarios**:

1. **Given** a Round with a bug set and two enhancement sets, **When** the card is shown, **Then** it lists the three under that Round, each with its text and its category (Bug or Enhancement), in the order sent.
2. **Given** a Round sent before this Feature (one note, no sets), **When** the card is shown, **Then** it lists the note as before, with no category.
3. **Given** another User, **When** they read Rounds, **Then** they see none of this Requester's sets.

### Edge Cases

- **Offline, or a failed send**: nothing changes and every set stays in the sheet (US1.9).
- **A bug set a triager thinks is really a wish** (or the reverse): triage reads the text and may recategorise; the category is the Requester's label, not a rule.
- **Every set is a bug**: still one Round and one follow-up Feature Issue; the Requester's request does not become a Bug Issue (D2).
- **Sets are not saved as a draft**: closing the sheet without sending keeps nothing, as for a single note today (D4).
- **Total length**: 5 sets of 4,000 characters is far under GitHub's Issue body limit.
- **A request before this Feature ships**: its past Rounds have no sets and list as one note (US2.2); the deployed app keeps working during the migration (D5).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Give feedback MUST accept 1–5 sets, each text 10–4,000 characters after trimming and each category `enhancement` or `bug`; the server MUST check the same and answer `invalid` otherwise.
- **FR-002**: A Round MUST keep its sets, in order, with their categories, readable only by the Requester.
- **FR-003**: A Round MUST still create exactly one follow-up Feature Issue, with each set under its own category heading in `### Problem` and the counts in `### Additional details`.
- **FR-004**: The card MUST list each Round's sets with their categories, and a Round with no sets as one note.
- **FR-005**: Everything else in spec 135's Give feedback (who may, when, the limit, the public notice, the undo, the sync following the newest Round) MUST be unchanged.
- **FR-006**: The migration MUST keep the app deployed before it working (ADR 0003), and `giveFeedback` MUST still accept a single legacy `feedback` string (as one Enhancement set) so a browser tab left open on the old client keeps working.

### Key Entities

- **Round**: gains **feedback sets**.
- **Feedback set**: one piece of a Requester's feedback in a Round: its text and its category, **Enhancement** or **Bug**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Requester can send one bug set and two enhancement sets in one Round in under 60 seconds.
- **SC-002**: In the follow-up Feature Issue, 100% of sets appear separately under their category.

## Out of Scope

- Creating a Bug Issue (or one Issue per set) from a bug set (D2).
- Adding sets to a Round after it was sent, or saving drafts (D3, D4).
- Giving feedback on a request that is not Ready to try, or on someone else's request.
- Any change to `/deliver`, `triage.md` or the Feature template: the Issue body already says what each set is.

## Ready to try

On a feature you're trying, open **Settings → Feature requests** and tap **Give feedback**. You can now write several separate pieces of feedback in one go: tap **Add another set** for each one, and mark each as an **Enhancement** (something you'd like better) or a **Bug** (something that's broken). Everything is sent together as one more Round, and your card lists each piece with its label.

Guesses made: up to 5 pieces per Round; they are sent all at once and not saved if you close the sheet; a bug is still handled as part of the same Round, not on its own.

## Assumptions

- Up to 5 sets in a Round is plenty for one pass of testing, and keeps the Issue readable.
- Enhancement is the default category, since most feedback is a wish.
- All sets of one Round go in one follow-up Feature Issue, so the sync's "newest Issue" rule (spec 135 D1) is unchanged.
- Feedback is posted publicly on GitHub as before, and the sheet's notice stays.

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | One Issue with a section per set, or one Issue per set? | One follow-up Feature Issue per Round, a section per set in `### Problem` | One Issue per set (the sync follows only the newest Issue per request, so the others would be ignored; needs a new link between Issues) | high |
| D2 | Does a bug set become a Bug Issue? | No: a Round's sets are all triaged as the one follow-up Feature; the category is a label for the reader | A Bug Issue per bug set (a second path through the sync, the limit and the card, for a few friends) | medium |
| D3 | Can sets be added over time, or only sent as one batch? | One batch, in the Give feedback sheet | Adding sets to an open Round (the Issue is already with triage; would need Issue edits and race with the agents) | high |
| D4 | Are unsent sets kept as a draft? | No, as for a single note today | Saving drafts (a table or storage for little gain) | high |
| D5 | How are sets stored, compatibly with the deployed app? | A nullable `sets jsonb` column on `feature_request_rounds`, inside the existing RLS; `feedback` still holds the first set's text so the deployed app's reads and 10–4,000 check keep working; a new `start_feature_request_round(request_id, requester_id, sets jsonb)` overload validates sets and sets `feedback`, and the old overload stays | A new table (more RLS for an ordered list read only with its Round); replacing the old function's signature (breaks the app deployed before the migration) | high |
| D6 | How does this fit the Round and the 2-at-a-time limit? | Unchanged: sets are inside one Round, and the Round counts once towards the limit | Counting each set (would stop a Requester sending the several sets this Feature is for) | high |
| D7 | How many sets? | 1–5 | Unlimited (an unreadable Issue) | medium |
| D8 | How does the Issue show the category? | Each set under a bold heading `Bug 1`, `Enhancement 1`, … numbered within its category, in the order sent, and counts in `### Additional details` | A label on the Issue per category (labels do not say which set) | high |
| D9 | Do workflow files need to change? | No: `triage.md` already judges `### Problem` and the Issue states each category in words | Teaching triage a new heading (changes guardrail files for no gain) | medium |
| D10 | Which control chooses the category? | Two radio options per set, labelled Enhancement and Bug, 44 px high | A dropdown (more taps on a phone) | high |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | No | Reuses the existing GitHub token | |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | No | One nullable column added; no data touched | |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | No | GitHub is faked as in spec 135 | |
| Touches sign-in, RLS policies or what one User can see of another | Yes | No policy changes, but Slice 1 adds a `security definer` function that writes Rounds (granted to `service_role` only, as in spec 135), which the merge gate flags; the new column sits under the Rounds policy limiting reads to the Requester, and a pgTAP test proves it | 1 |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | No | No workflow file changes (D9) | |
| Contradicts an ADR or needs a new one | No | | |
| Size L or XL | No | Size M: one column and function, an Issue body, an action and a sheet | |

**Size**: M

**Human review**: Needed for the spec and Slice 1
