# Feature Specification: Toggles for every new Feature

**Spec issue**: #116

**Feature**: #113

**Created**: 2026-11-08

**Status**: Draft

**Depends on**: `docs/specs/002-sign-in-and-app-shell.md` (Allowed Emails), `docs/specs/009-settings-and-goal.md` (the Settings screen)

**ADRs**: [0007](../../docs/adr/0007-spec-driven-pull-requests-gated-by-risk.md) (partly superseded), [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (added by this spec)

**Input**: Feature description: "New behaviour reaches every User the moment its last Slice deploys, and until then a feature must stay unreachable. There is no way to let one User try a feature in production first, gather feedback, and only then release it, or to pull it back without a code change. Every new Feature ships behind a Toggle, off for everyone; the Owner can switch on any Toggle in Testing for themselves; `/deliver` builds every new Feature this way, and triage accepts when in doubt."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The app knows whether a Toggle is on for me (Priority: P1)

A new feature's code can ask "is my Toggle on for this User?", in the browser and on the server, and get the same answer the database gives. Nobody sees anything new: until a Feature adds a Toggle, there are none.

**Why this priority**: every other story, and every later Feature, depends on it.

**Independent Test**: pgTAP proves the states, the Owner's override and that one User cannot read or change another's overrides; Vitest proves the client and server helpers treat missing, loading and failed Toggles as off.

**Acceptance Scenarios**:

1. **Given** no Toggle with a key exists, **When** the app asks whether it is on, **Then** the answer is off, in the browser and on the server.
2. **Given** a Toggle in Testing, **When** a User who is not the Owner asks, **Then** it is off for them, and they cannot turn it on.
3. **Given** a Toggle in Testing, **When** the Owner turns it on for themselves, **Then** it is on for the Owner and still off for every other User.
4. **Given** a Toggle that is Live, **When** any User asks, **Then** it is on, whatever any override says.
5. **Given** a Toggle that is Removed, **When** any User asks, including one who had turned it on, **Then** it is off.
6. **Given** a User's override, **When** another User reads, adds, changes or deletes overrides, **Then** they see none of it and cannot change it.
7. **Given** a Toggle that is Live or Removed, **When** anyone tries to set it back to Testing, or a Live Toggle to Removed, **Then** the change is refused.
8. **Given** the Owner turned a Toggle on, **When** they stop being the Owner, **Then** it is off for them.
9. **Given** the browser is still loading Toggles, or loading failed, **When** a feature asks, **Then** the answer is off.

---

### User Story 2 - The Owner tries features in Testing from Settings (Priority: P2)

On the Settings screen the Owner sees a "Try new features" section listing every Toggle in Testing, each with its title and an on/off control. Turning one on shows that feature to the Owner straight away; turning it off hides it again. Other Users never see the section.

**Why this priority**: without it, a Toggle in Testing is off for everyone and nobody can try the feature.

**Independent Test**: Testing Library covers the section's states; Playwright signs in as the seeded Owner, turns on a seeded Toggle and sees it stay on after a reload, and signs in as another User and sees no section.

**Acceptance Scenarios**:

1. **Given** the Owner and at least one Toggle in Testing, **When** they open Settings, **Then** "Try new features" lists each one by title with its control showing whether it is on for them.
2. **Given** the Owner, **When** they turn a Toggle on, **Then** the control shows on at once, and it is still on after a reload.
3. **Given** saving fails (offline or an error), **When** the Owner turns a Toggle on, **Then** the control goes back to off and a message says it couldn't be saved.
4. **Given** a User who is not the Owner, **When** they open Settings, **Then** there is no "Try new features" section.
5. **Given** the Owner and no Toggle in Testing, **When** they open Settings, **Then** there is no "Try new features" section.

---

### User Story 3 - Agents build every new Feature behind a Toggle (Priority: P3)

When `/deliver` writes a spec for a new Feature, the spec's first Slice adds the Feature's Toggle in a migration and every Slice gates its new behaviour on it. The constitution, `AGENTS.md`, the workflow and the spec-kit templates say so, instead of "unreachable until the last Slice". Triage accepts a Feature when in doubt and writes its assumptions into the spec, and asks the Owner only for product or risk decisions.

**Why this priority**: it changes how every later Feature is built, so it lands once the Toggles it describes exist.

**Independent Test**: a review of the changed documents against ADR 0008; nothing in them still says "unreachable until the last Slice" or "no feature flags".

**Acceptance Scenarios**:

1. **Given** the constitution, `AGENTS.md`, `docs/agents/workflow.md` and the spec, plan and tasks templates, **When** they are read, **Then** they require a Toggle for every new Feature, with the first Slice adding it, and none says a feature stays unreachable until its last Slice or that there are no feature flags.
2. **Given** `/deliver`'s `triage.md`, **When** a Feature is specific enough to guess the rest, **Then** it is accepted and the guesses are recorded in the spec's Assumptions, and **Ask** is kept for product or risk decisions only the Owner can make.
3. **Given** `/deliver`'s `change.md`, **When** an agent delivers a Slice of a Feature, **Then** it gates the new behaviour on the Feature's Toggle with the helpers from User Story 1, and new routes answer 404 while the Toggle is off.

### Edge Cases

- **No Toggles at all** (production until a Feature adds one): every helper answers off and the Settings section is hidden.
- **A Toggle's key with no row**: off, so code merged before its migration ran shows nothing.
- **Loading, error and offline**: the browser treats Toggles as off until they load; a failed save rolls back and says so; an offline save fails the same way.
- **The Owner changes**: overrides of someone who is no longer the Owner stop counting, but are kept.
- **A Toggle goes Live or Removed while a page is open**: the new state shows the next time Toggles are fetched (on focus or navigation); no live push.
- **Two Toggles in Testing**: each has its own override; turning one on changes nothing else.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each Toggle MUST have a key `feature-<Feature Issue number>`, a title, and exactly one state: Testing, Live or Removed.
- **FR-002**: A Toggle MUST be on for a User when it is Live, or when it is in Testing and that User is allowed to try it and has turned it on; otherwise it MUST be off, including when no Toggle has that key.
- **FR-003**: Only the Owner MUST be allowed to try a Toggle in Testing (Feature #114 adds the requester).
- **FR-004**: A User MUST be able to turn a Toggle on or off only for themselves, only while it is in Testing, and only if allowed to try it.
- **FR-005**: No User MUST be able to read or change another User's overrides, or change any Toggle's state, through the API.
- **FR-006**: A Toggle's state MUST only move from Testing to Live or from Testing to Removed.
- **FR-007**: The app MUST offer one helper for the browser and one for the server that answer whether a Toggle is on for the signed-in User, both treating missing, loading and failed as off.
- **FR-008**: The Settings screen MUST show the Owner a "Try new features" section listing each Toggle in Testing with an on/off control, and MUST NOT show it to anyone else or when there is no Toggle in Testing.
- **FR-009**: Turning a Toggle on or off MUST update the control at once and roll back with a message if saving fails.
- **FR-010**: The Owner MUST be marked in the database alongside the Allowed Emails, set by hand, never through the API.
- **FR-011**: The repo's rules, workflow, templates and `/deliver` MUST require a Toggle for every new Feature, as ADR 0008 describes.

### Key Entities

- **Toggle**: one per Feature; key, title, state (Testing, Live or Removed).
- **Toggle override**: one User's choice to turn one Toggle in Testing on or off for themselves.
- **Owner**: the User whose Allowed Email is marked as the Owner's.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a Toggle in Testing, the Owner can turn it on from Settings and see the feature within one screen refresh, while every other User still sees nothing new.
- **SC-002**: Deploying the whole of this spec changes nothing any User sees, until a Feature adds a Toggle.
- **SC-003**: Every new Feature specified after this spec has a first Slice that adds its Toggle.

## Out of Scope

- Changing a Toggle's state from the app. Until Feature #115 adds Ready and Remove, a Toggle goes Live or Removed through a migration in the Chore that deletes its checks or its feature.
- Letting a requester try their own feature (Feature #114).
- Percentage rollouts, groups, or turning a feature on for another User.
- Telling the app instantly when a Toggle changes (it refetches on focus).

## Assumptions

- The Owner is a single User; more than one marked Owner would each get the Owner's powers, which is harmless for a few friends.
- A Toggle's title is the Feature's title without its `Feature: ` prefix, written by the Slice that adds the Toggle.
- Users can see that a Toggle exists (its key, title and state), since the same titles are public on GitHub; only overrides are private.

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | Where do Toggles live? | Supabase tables `toggles` and `toggle_overrides` | Vercel Flags or Edge Config (new integration, second store); environment variables (no per-User Testing) | high |
| D2 | How is the Owner marked, given `allowed_emails` is unreachable through the API? | An `is_owner` column on `allowed_emails`, read only by a `security definer` function `is_owner()` that matches the caller's email claim | An environment variable (trips the merge gate's new-variable rule, and RLS cannot read it); a column on `user_settings` (a User could set it themselves) | high |
| D3 | Who decides whether a Toggle is on? | One database function, `toggle_is_on(key)`, used by both helpers, so the browser and server never disagree | Computing it in TypeScript from raw rows (two places to keep in step) | high |
| D4 | What does a missing, loading or failed Toggle mean? | Off | On (would show half-built features on error) | high |
| D5 | Can a Toggle's state go backwards? | No, a trigger refuses it: Testing → Live or Removed only | Allow any change (a Removed feature's tables may already be dropped, so turning it back on would break) | high |
| D6 | Can the Owner change a Toggle's state from the app in this spec? | No; state changes by migration until Feature #115 | A state control in Settings (scope creep; #115 designs it with the requester) | medium |
| D7 | What happens to an override when someone stops being the Owner? | It stays but no longer counts, because `toggle_is_on` re-checks who may try it | Deleting it (needs a trigger on a table the API cannot reach) | high |
| D8 | Where does the Owner try Toggles? | A "Try new features" section on Settings, hidden unless there is something to try | A separate screen (more navigation for one list) | high |
| D9 | Does this spec need its own Toggle? | No: Toggles cannot sit behind themselves, and nothing is visible until a Toggle exists, which keeps the feature unreachable in the old sense | Gating the Settings section on a bootstrap Toggle (circular) | high |
| D10 | Do guardrail and workflow documents change in the Spec pull request? | Only ADR 0008, the ADR 0007 note and `CONTEXT.md`; the constitution, `AGENTS.md`, workflow, templates and `/deliver` change in Slice 3, once the helpers exist | All in the Spec pull request (agents would be told to use helpers that are not merged yet) | high |
| D11 | Can a User see Toggles they cannot try? | Yes, the Toggle rows; their titles are public on GitHub anyway. Overrides are private | Hiding Toggles in Testing (needs the same check in every policy, for no privacy gain) | medium |
| D12 | Should triage accepting "when in doubt" apply to the Owner's own Features too? | Yes, every Feature, as decided with the Owner on 2026-11-08 | Only in-app requests (two triage rules) | high |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | Yes | The Owner sets `is_owner` by hand on their Allowed Email in production (a `human-step`), as they do for Allowed Emails | 1 |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | No | Only additive tables, a column with a default and new functions | |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | No | pgTAP, Vitest, Testing Library and Playwright cover every scenario | |
| Touches sign-in, RLS policies or what one User can see of another | Yes | New RLS policies, and the Owner gains a power other Users lack | 1 |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | Yes | The constitution, `AGENTS.md`, `workflow.md`, the spec-kit templates and `/deliver` change | 3 |
| Contradicts an ADR or needs a new one | Yes | Adds ADR 0008, superseding part of ADR 0007 | Spec |
| Size L or XL | No | Two tables, three functions, two helpers, one Settings section and documentation | |

**Size**: M

**Human review**: Needed for the spec and Slices 1 and 3
