# Feature Specification: Settings in categories

**Spec issue**: #168

**Feature**: #167

**Created**: 2026-11-09

**Status**: Draft

**Depends on**: `docs/specs/009-settings-and-goal.md` (the Settings screen), `specs/147-dark-mode/spec.md` (Appearance), `specs/124-feature-requests/spec.md` (the Feature Requests row)

**ADRs**: [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (every new Feature ships behind a Toggle)

**Input**: Feature description: "Each new setting is just getting added to the bottom of the list, there is no grouping or prioritisation, so the screen is hard to read. I'd like the settings page to be organised into categories that link off to separate pages."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Settings is a short list of categories, each on its own page (Priority: P1)

With the Toggle on for them, a User opens Settings and sees a short list of category rows (Tracking, Preferences, Features) above their Account and About. Tapping a row opens that category's page, which holds the settings that used to sit in the one long list. A back control returns to Settings.

**Why this priority**: it is the whole Feature.

**Independent Test**: Testing Library covers the category list and each category page's sections; Playwright opens a category, changes a setting and returns.

**Acceptance Scenarios**:

1. **Given** the Toggle is on for the User, **When** they open Settings, **Then** they see the rows Tracking, Preferences and Features, each a link at least 44 px high, followed by About and Account.
2. **Given** the Toggle is off for the User, **When** they open Settings, **Then** the page is the single list it is today.
3. **Given** the Toggle is on, **When** they tap Tracking, **Then** `/settings/tracking` shows Daily goal, Calories burned and Week start, each working as before.
4. **Given** the Toggle is on, **When** they tap Preferences, **Then** `/settings/preferences` shows Reminder, Vibration and Appearance (Appearance still only where its own Toggle is on).
5. **Given** the Toggle is on, **When** they tap Features, **Then** `/settings/features` shows Try features and the Feature Requests row, each only where it shows today.
6. **Given** a category page, **When** the User taps back, **Then** they return to Settings.
7. **Given** the Toggle is on, **When** a category has no section visible to the User, **Then** its row is not shown.
8. **Given** the Toggle is off, **When** the User opens `/settings/tracking`, `/settings/preferences` or `/settings/features` directly, **Then** they are sent to `/settings`.
9. **Given** Toggles are loading or failed to load, **When** Settings opens, **Then** it shows the single list as today, never an empty page.

### Edge Cases

- **Direct links and reloads** on a category page work (they are ordinary routes).
- **Offline**: category pages behave like Settings does today.
- **Bottom navigation** keeps Settings highlighted on every category page.
- **Existing `/settings/feature-requests` routes** are unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Where Toggle `feature-167` is on, Settings MUST show category rows linking to separate pages, with About and Account remaining on Settings.
- **FR-002**: Every setting MUST live in exactly one category and keep working as before.
- **FR-003**: Where the Toggle is off, loading or failed, Settings MUST be exactly as today.
- **FR-004**: Category rows and back controls MUST be at least 44 px high; copy MUST be Australian English.

### Key Entities

- **Settings category**: a named group of settings with its own page. Not stored; fixed in code.

## Success Criteria *(mandatory)*

- **SC-001**: With the Toggle on, the Settings screen fits on one phone screen (360 × 640 px) without scrolling.
- **SC-002**: Any setting is reachable in two taps from Settings.
- **SC-003**: Deploying this spec changes nothing any User sees until the Toggle is on for them.

## Out of Scope

- New settings, or renaming or removing any setting.
- Search within Settings.
- Making the categorised layout the default once Live (a later Chore).

## Ready to try

Open Settings. Instead of one long list you now see Tracking, Preferences and Features. Tap one to reach its settings, and use the back arrow to return. About and your account stay on the main Settings page.

Guesses made: which setting sits in which group (Tracking has the goal, calories burned and week start; Preferences has the reminder, vibration and appearance; Features has trying features and feature requests).

## Assumptions

- Three categories are enough for the current ten sections and leave room to grow.
- Account and About stay on the main page so sign-out stays one tap away.
- Gated with its own Toggle, `feature-167`, as ADR 0008 requires.

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | Which categories? | Tracking (Goal, Burned, Week start), Preferences (Reminder, Vibration, Appearance), Features (Try features, Feature Requests) | Fewer, bigger groups (still long); one page per setting (too many taps) | medium |
| D2 | Routes? | `/settings/tracking`, `/settings/preferences`, `/settings/features`, beside the existing `/settings/feature-requests` | Query-string tabs (not linkable, no back button) | high |
| D3 | Where do Account and About go? | Stay on `/settings` | Own category (sign-out buried) | medium |
| D4 | How is the Toggle applied? | A client component reads `useToggle("feature-167")` on each route; off, loading or failed renders today's single list on `/settings` and redirects category routes to `/settings` once loaded off | Server-side check (Toggles are per User on the client; matches ADR 0008 usage elsewhere) | medium |
| D5 | Is anything stored? | No migration beyond the Toggle row | A per-User category order | high |
| D6 | Hide empty categories? | Yes (US1.7) | Show an empty page | high |
| D7 | One Slice or two? | One: the hub and the pages are inseparable, and the diff is mostly moving existing sections | Two (a half-built hub would ship) | high |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | No | | |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | No | The only migration inserts the Toggle row | |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | No | Playwright covers it | |
| Touches sign-in, RLS policies or what one User can see of another | No | Account stays as is | |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | No | | |
| Contradicts an ADR or needs a new one | No | Follows ADR 0008 | |
| Size L or XL | No | Moves existing sections behind three routes | |

**Size**: M

**Human review**: Not needed
