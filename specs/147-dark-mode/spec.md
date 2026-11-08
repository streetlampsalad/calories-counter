# Feature Specification: Dark mode

**Spec issue**: #147

**Feature**: #146

**Created**: 2026-11-08

**Status**: Draft

**Depends on**: `docs/specs/009-settings-and-goal.md` (the Settings screen), `docs/specs/012-installable-app.md` (the installed app's colours), `docs/specs/015-gestures-and-haptics.md` (a setting kept on this phone only)

**ADRs**: [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (every new Feature ships behind a Toggle)

**Input**: Feature description: "I want to be able to toggle the app into dark mode." The Feature gave no Problem or details, so the assumptions are under Assumptions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose Light, Dark or System in Settings (Priority: P1)

With the Toggle on for them, a User sees an "Appearance" section in Settings with three choices: Light, Dark and System. Picking one changes the whole app straight away and is remembered on this phone. System follows the phone's own light or dark setting, including when it changes while the app is open.

**Why this priority**: it is the whole Feature; without it nothing changes for anyone.

**Independent Test**: Testing Library covers the section's choices and its hidden states; Vitest covers reading, saving and resolving the choice; Playwright switches to Dark in Settings, sees the app go dark, reloads and sees it stay dark.

**Acceptance Scenarios**:

1. **Given** the Toggle is on for the User, **When** they open Settings, **Then** an "Appearance" section offers Light, Dark and System, with the current choice selected.
2. **Given** the Toggle is off for the User, **When** they open Settings, **Then** there is no "Appearance" section and the app looks as it does today.
3. **Given** no choice has been made on this phone, **When** the app opens, **Then** it is Light, as today, and Light is the selected choice.
4. **Given** the "Appearance" section, **When** the User picks Dark, **Then** the whole app uses the dark colours at once, with no reload, and the choice is still Dark after a reload.
5. **Given** the User picked System and the phone is set to dark, **When** the app opens, **Then** it is dark; **and when** the phone switches to light while the app is open, **Then** the app goes light without a reload.
6. **Given** the User picked Dark, **When** they pick Light, **Then** the app goes light at once and stays light after a reload.
7. **Given** a phone that blocks site storage, **When** the User picks Dark, **Then** the app goes dark for this visit and, after a reload, is Light with no error.
8. **Given** the User picked Dark on one phone, **When** they sign in on another, **Then** the other phone is unchanged, because the choice is kept on each phone, not with the User.

---

### User Story 2 - Dark from the first frame, and in the phone's own chrome (Priority: P2)

A User who chose Dark never sees a white flash when the app opens or a page loads, and the phone's status bar, the toasts and the installed app's colours match the choice.

**Why this priority**: the Feature works without it, but a white flash on every open makes dark mode feel broken.

**Independent Test**: Vitest covers the choice-to-colour mapping; Playwright loads a page with Dark saved and checks the page is dark before the app finishes loading and that the theme colour matches.

**Acceptance Scenarios**:

1. **Given** the User chose Dark, **When** any page loads, **Then** the page background is dark from the first paint, with no white flash.
2. **Given** the User chose Dark or Light, **When** the app is open, **Then** the browser's theme colour (status bar) is the matching colour, whatever the phone's own setting.
3. **Given** the User chose Dark, **When** a toast appears, **Then** it uses the dark colours.
4. **Given** nobody has chosen anything, **When** the app loads, **Then** the page, the theme colour and the toasts are exactly as today.

### Edge Cases

- **Nothing saved, or a saved value the app does not know**: treated as Light, never an error.
- **Storage blocked** (private windows, cleared site data): the choice lasts for the visit only; reading and writing are wrapped so nothing throws.
- **Toggle loading, failed or off**: no "Appearance" section, as for any Toggle; a choice already saved on the phone still applies, because it is applied before Toggles can load (see D4).
- **Phone switches light or dark while System is chosen**: the app follows without a reload.
- **Two tabs**: a change in one tab shows in the other.
- **Dark colours**: every screen, sheet, chart and the Add button must stay readable (contrast as in Light) and keep 44 px touch targets; nothing may rely on a colour that exists only in Light.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST offer three appearance choices: Light, Dark and System.
- **FR-002**: Until a choice is made on a phone, the app MUST look as it does today (Light).
- **FR-003**: The choice MUST apply to the whole app at once and survive a reload, kept on the phone and not with the User.
- **FR-004**: System MUST follow the phone's light or dark setting, including changes while the app is open.
- **FR-005**: The app MUST apply a saved choice before first paint, so Dark never flashes white.
- **FR-006**: The theme colour, toasts and charts MUST follow the chosen appearance.
- **FR-007**: The "Appearance" section MUST appear only where Toggle `feature-146` is on for the User.
- **FR-008**: Reading or writing the saved choice MUST never throw; a failure leaves the visit's choice in place and the next load Light.
- **FR-009**: Copy MUST be Australian English, and Settings controls MUST be at least 44 px high.

### Key Entities

- **Appearance**: the User's choice of Light, Dark or System, kept on one phone. Not a column in the database.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A User with the Toggle on can switch the whole app to Dark in two taps from the bottom navigation (Settings, then Dark).
- **SC-002**: With Dark saved, no frame of a page load is white.
- **SC-003**: Deploying the whole of this spec changes nothing any User sees until the Toggle is on for them.

## Out of Scope

- Saving the choice with the User or syncing it between phones.
- More than two palettes, accent colours or a schedule (such as dark after sunset).
- Redrawing icons, the app icon or the manifest's fixed colours for the installed app's splash screen (the manifest cannot change per choice).
- Making Dark or System the default once the Toggle is Live. A later Chore decides that with the Owner.

## Ready to try

Open Settings and find "Appearance". Tap Dark to turn the whole app dark, Light to put it back, or System to follow your phone's own light or dark setting. Your choice is remembered on that phone only.

Guesses made: until you pick something the app stays light as it is now, and the choice is saved on each phone rather than on your account.

## Assumptions

- The choice is per phone, kept in the browser like Vibration, because the Feature asked for a toggle and nothing about syncing.
- The control lives in Settings, as the Feature said "toggle", but as three choices, because System is what a phone user expects.
- The existing dark colours in the stylesheet are the starting palette; Slice 1 fixes any screen that does not read well in them.
- Not choosing keeps the app Light, so a Toggle in Testing cannot change how anyone's app looks by accident.

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | Where is the choice kept? | `localStorage` on the phone, as Vibration is | A column on `user_settings` (a migration and a sync for a cosmetic setting nobody asked to share); a cookie (server rendering would then depend on it) | high |
| D2 | How is the dark theme applied? | `next-themes` (already installed for toasts) sets the `dark` class the stylesheet already defines, with a `localStorage` key, `disableTransitionOnChange` and `defaultTheme="light"` | A hand-written provider and script (reinvents what is installed); the CSS `prefers-color-scheme` media query alone (no manual choice) | high |
| D3 | What is the default before a choice? | Light, as today | System (every User on a dark phone would see the app change the day the Toggle goes on, which is the point of a Toggle) | high |
| D4 | Does the Toggle gate the applying of a saved choice? | No: the Toggle gates only the "Appearance" section. A saved choice can exist only because a User with the Toggle on made it, and applying it before first paint cannot wait for the database | Gating the provider on the Toggle (the Toggle loads after first paint, so Dark would flash white every load) | medium |
| D5 | What if a Toggle goes Removed and the choice remains? | The Removal Chore deletes the code, and with it the saved choice's effect; the stored value is harmless | Clearing it from every phone (impossible from the server) | high |
| D6 | Does the theme colour follow the choice? | Yes, through next-themes' resolved theme setting the `theme-color` meta; the manifest keeps its fixed colours | Leaving the media-query pair (a Dark choice on a light phone gets a light status bar) | medium |
| D7 | What does Dark mean for charts and the toasts? | They read the same colour variables, so they follow; toasts already use `useTheme` | A separate chart palette (two places to keep in step) | medium |
| D8 | One Slice or two? | Two: the control and the colours first, then no flash and the chrome | One (the flash fix touches the root layout and is the riskier half to review alone) | high |
| D9 | New dependency? | None: `next-themes` is already in `package.json` | Adding another library | high |
| D10 | Does the Add button, the bottom navigation or any sheet need a dark variant? | Only where the screen uses a colour that is not a variable; Slice 1 checks each screen with Playwright screenshots in Dark and fixes the ones that fail the contrast checks | Declaring the existing palette done unchecked | medium |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | No | `next-themes` is already installed; no secret or variable | |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | No | The only migration inserts the Toggle row | |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | No | Playwright emulates the colour scheme and storage; the real status bar colour is a manual check at Ready to try | |
| Touches sign-in, RLS policies or what one User can see of another | No | The choice never leaves the phone | |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | No | | |
| Contradicts an ADR or needs a new one | No | Follows ADR 0008 | |
| Size L or XL | No | Two Slices of a provider, a section and some colour fixes | |

**Size**: M

**Human review**: Not needed
