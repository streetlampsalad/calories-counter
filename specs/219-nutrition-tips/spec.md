# Feature Specification: Nutrition tips for last week

**Spec issue**: #219

**Feature**: #218

**Created**: 2026-11-13

**Status**: Draft

**Depends on**: `docs/specs/010-summaries.md` (the Summary screen and Periods), `docs/specs/007-add-food-search.md` (the Gemini best guess and the daily AI allowance), `docs/specs/006-add-food-photo-import.md` (`ai_usage` and `increment_ai_usage`), `specs/116-toggles/` (Toggles)

**ADRs**: [0001](../../docs/adr/0001-entries-reference-foods-live.md) (Entries reference Foods live), [0003](../../docs/adr/0003-trunk-based-with-gated-deploys.md) (migrations ship first), [0004](../../docs/adr/0004-planned-entries-by-date-alone.md) (what counts as eaten stops at today), [0008](../../docs/adr/0008-every-new-feature-ships-behind-a-toggle.md) (every new Feature ships behind a Toggle)

**Input**: Feature description: Feature #218, a Feature Request. "I'd like to see an AI nutritional guide/recommendation based on what I've eaten each week. As an example maybe after looking through all of my food for a week then after analysing the nutritional properties of all the food, the AI suggestion should say something like, 'you haven't had much omega 3 this week, maybe look at adding some salmon on the menu for next week'. It doesn't need to be exactly that, it's just an example. I don't want a full detailed nutritional breakdown, just some simple recommendations. I know AI isn't always accurate so it's just a recommendation." Additional details: "Use the existing Gemini integration and try and keep it free as far as usage. The nutritional data can be a best guess from the AI for the food consumption, it doesn't need to be accurate."

**Behind Toggle**: `feature-218`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get Nutrition tips for last week (Priority: P1)

With the Toggle on, the Summary screen ends with a **Nutrition tips** card about last week (the last full week, starting on the day their week starts on in Settings). The User taps **Get tips**. The server gathers the Foods they logged that week (name, Portion, Calories per Portion and total Quantity) and asks Gemini for up to three short tips, each naming a nutrient they seem to be short of and one or two everyday foods that would add it, for example "**Omega-3**: Not much oily fish last week. Salmon or sardines once or twice next week would help." The card shows the tips under a line saying they are AI guesses from Food names, not medical or dietary advice.

**Why this priority**: it is the whole request.

**Independent Test**: Vitest proves the week's Food summary, the prompt input, the tidy-up of the model's answer and the route's checks with a fake tips writer; Testing Library proves the card's states; Playwright gets tips through the fake writer.

**Acceptance Scenarios**:

1. **Given** the Toggle `feature-218` is on for a User, **When** they open Summary, **Then** a **Nutrition tips** card shows last week's Days (for example "3–9 Nov") and a **Get tips** button at least 44 px high, whichever Period chip is chosen.
2. **Given** the Toggle is off, loading or failed, **When** the User opens Summary, **Then** there is no card, and `POST /api/nutrition-tips` answers 404.
3. **Given** last week has fewer than 3 Logged Days, **When** the card shows, **Then** it says "Log food on at least 3 days in a week to get tips." with no button, and the route refuses the week with `not_enough_days`.
4. **Given** last week has at least 3 Logged Days, **When** the User taps **Get tips**, **Then** the button shows it is working, the server sends Gemini only the week's Food names, Portions, Calories per Portion, total Quantities and the number of Logged Days (never the User's name, email or ids), and the card shows one to three tips, each with its nutrient in bold, under "AI guesses from your food names, not medical or dietary advice."
5. **Given** the model's answer, **When** the server reads it, **Then** it keeps at most three tips, trims each, drops any with an empty nutrient or tip, cuts a nutrient to 40 and a tip to 200 characters, and answers `tips_failed` when none is left.
6. **Given** the system prompt, **Then** it asks for tips that add foods (never eat less, skip meals, a calorie number, weight, supplements or a medical condition), in Australian English with foods sold in Australia, and says the nutrition is a best guess from Food names.
7. **Given** the User has asked for tips 3 times today (a Day in Sydney), **When** they tap **Get tips** again, **Then** the card says "You can get tips 3 times a day. Try again tomorrow." and Gemini is not called.
8. **Given** Gemini is out of quota, down or too slow, **When** the User taps **Get tips**, **Then** the card says "Tips aren't available right now. Try again later." and keeps the button (the try still counts towards the 3 a day, D5); any other failure, or no connection, says "Couldn't get tips." with **Try again**.
9. **Given** the request's week start is not a date, is not on the day the User's week starts on, ends after today in Sydney, or starts more than 14 Days ago, **When** the route reads it, **Then** it answers 400 `bad_week` and calls nothing.
10. **Given** the Toggle is on, **When** the User opens Settings → About, **Then** "Photos and best guesses" also says that getting Nutrition tips sends last week's Food names and Quantities to Gemini on its free tier.

---

### User Story 2 - Keep last week's tips (Priority: P2)

Tips are kept, one set per User per week, so opening Summary again shows them straight away without asking Gemini again. **Ask again** replaces them with a new set, counted against the same 3 a day.

**Why this priority**: it keeps the feature free and quick to reopen, but tips work without it.

**Independent Test**: pgTAP proves the table and its RLS; Vitest proves the route saves the set; Testing Library proves the card shows a kept set and Ask again; Playwright reloads Summary and sees the same tips.

**Acceptance Scenarios**:

1. **Given** the User got tips for last week, **When** they open Summary again, **Then** the card shows those tips at once with **Ask again**, and Gemini is not called.
2. **Given** kept tips, **When** the User taps **Ask again**, **Then** the new tips replace the kept ones (one set per User per week), counted against the 3 a day; on failure the kept tips stay and the error shows under them.
3. **Given** a new week starts, **When** the User opens Summary, **Then** the card is about the new last week, with **Get tips** and none of the old tips.
4. **Given** another User, **When** they read, add, change or remove Nutrition tips, **Then** they never see or change this User's.
5. **Given** the database, **When** a set with no tips, more than three, or tips that are not a list is written, or a second set for the same User and week is added, **Then** it is rejected.
6. **Given** the Toggle is off, **When** the User opens Summary, **Then** no kept tips are read or shown.

### Edge Cases

- **Archived Foods** eaten last week are included; they were eaten.
- **Entries changed after getting tips** do not change kept tips; **Ask again** uses the Entries as they are now.
- **The day the week starts on changed** in Settings: last week is computed with the new setting, so the card may show a different week with no tips yet.
- **Many Foods**: only the 80 Foods with the most Calories that week are sent, to keep the request small.
- **Food names in other languages or nonsense**: sent as written; the model is told it is a best guess and never to refuse.
- **Offline**: the card shows kept tips (from the query cache) and **Get tips** fails with "Couldn't get tips."
- **Turning the Toggle off** hides the card; kept tips stay stored and show again when it is on.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Everything in this spec MUST be off unless Toggle `feature-218` is on for the User; the route answers 404 and the card is absent while off, loading or failed.
- **FR-002**: Tips MUST cover last week only: the 7 Days before the start of this week, by the day the User's week starts on. The route checks this against the User's settings, not only the browser.
- **FR-003**: The server MUST send Gemini only Food names, Portions, Calories per Portion, total Quantities and the Logged Days count; nothing identifying the User.
- **FR-004**: Gemini MUST be called only when the User taps **Get tips** or **Ask again**, at most 3 times per User per Day, counted with `increment_ai_usage` under its own kind.
- **FR-005**: A User MUST see one to three tips, each with a nutrient and a short suggestion that adds foods, under a line saying they are AI guesses, not advice.
- **FR-006**: The Gemini API key MUST be read only on the server.
- **FR-007**: Tips MUST be kept one set per User per week, and a User MUST NOT be able to read or change another User's.
- **FR-008**: Copy MUST be Australian English; touch targets at least 44 px.

### Key Entities

- **Nutrition tip**: a short AI-written suggestion of a nutrient a User may be short of and foods that would add it, drawn from the Foods in their last week of Entries. A best guess, never advice. See `CONTEXT.md`.
- **Kept tips** (`nutrition_tips` table, Slice 2): one row per User per week start, holding that week's tips. Not a glossary term; the UI just shows the tips.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A User with at least 3 Logged Days last week usually sees tips within 10 seconds of tapping **Get tips**; when Gemini is slow the card says so within about a minute (the transport's 25-second timeout and one retry).
- **SC-002**: Reopening Summary in the same week shows kept tips with no Gemini call.
- **SC-003**: Deploying this spec changes nothing any User sees until the Toggle is on for them.
- **SC-004**: No User can make more than 3 Gemini calls a day through this feature.

## Out of Scope

- A nutrient breakdown, numbers per nutrient, or nutrients stored on Foods.
- Tips for any Period other than last week, or for this week so far.
- Push notifications when tips are ready, or generating tips on a schedule.
- Calorie or weight advice, meal plans, or adding Planned Entries from a tip.
- A paid Gemini tier.

## Ready to try

On the Summary screen, scroll to the **Nutrition tips** card at the bottom and tap **Get tips**. After a few seconds it shows up to three simple suggestions based on what you logged last week, like a nutrient you seem low on and a food or two that would add it. They're kept for the week, and **Ask again** gets a fresh set (up to 3 times a day). The tips are AI guesses from your food names, so take them lightly.

Guesses made: tips cover last full week (not this week so far), you need food logged on at least 3 days that week, you get up to three tips, and they only suggest foods to add, never to cut back.

## Assumptions

- "Each week" means the last full week, by the day the User's week starts on (`last-week` Period), because the request talks about planning "next week".
- Three tips are "simple recommendations"; one nutrient each.
- 3 Logged Days is enough data for a useful guess; fewer gives tips about too little.
- 3 requests a day per User keeps a few friends well inside the Gemini free tier.
- The light model (`GEMINI_LIGHT_MODEL`) is good enough for a few short tips; the prompt is plain text in, a small JSON answer out.
- Gated with its own Toggle, `feature-218`, which the Requester can switch at Ready to try (spec 124).

## Decisions *(mandatory)*

| # | Question | Decision | Alternatives rejected | Confidence |
|---|---|---|---|---|
| D1 | Name for the concept? | **Nutrition tip**, added to `CONTEXT.md` | "Recommendation" or "advice" (sounds authoritative, and the app gives no advice); "Insight" (the Insights screen is about Calories) | high |
| D2 | Which week? | The last full week by the day the User's week starts on, the same Days as the `last-week` Period | This week so far (partial, changes daily); the last 7 Days (shifts every day, so kept tips never settle) | medium |
| D3 | Where does it show? | A card at the bottom of Summary, always about last week whatever Period chip is chosen | Insights (deeper, less seen); its own screen (more navigation for three lines) | medium |
| D4 | When is Gemini called? | Only when the User taps **Get tips** or **Ask again** | On opening Summary (spends quota for Users who don't look); on a weekly schedule (needs a cron and a push, and spends quota for everyone) | high |
| D5 | How is cost held to the free tier? | `increment_ai_usage('tips', 3)` per User per Day, counted before Gemini is called (as best guesses are), so a try that fails still counts; plus kept tips so reopening is free (Slice 2) | No limit (one User could exhaust the shared free quota); a weekly limit (no counter exists; a day limit reuses one); refunding failed tries (needs a new database function, and repeated failures usually mean the quota is gone for the day anyway) | medium |
| D6 | What does the server send? | Per Food: name, Portion, Calories per Portion, total Quantity; plus Logged Days. The 80 Foods with the most Calories over the week. No ids, no email, no name | Each Entry with its Day (more data, no better tips); Reference Food nutrients (the dataset has only energy loaded); the existing `food_totals` function (it has no Quantity) | high |
| D7 | Where do nutrients come from? | Gemini's best guess from Food names, as the Feature says; nothing stored | Loading AFCD nutrients (big data change, and most Foods are not Reference Foods) | high |
| D8 | Could tips harm a User (for example someone restricting food)? | The prompt allows only adding foods; never eat less, skip, calories, weight, supplements or conditions (US1.6); the card says it is not advice | Free-form advice (risky); no disclaimer | medium |
| D9 | Model? | `GEMINI_LIGHT_MODEL`, low thinking, JSON schema answer, through the existing `geminiTransport` (one retry on 503) | `GEMINI_MODEL` (slower, 503s seen in production) | medium |
| D10 | Answer shape? | `{ tips: [{ nutrient, tip }] }`, parsed with zod, then tidied by the server (US1.5) | Free text (unparseable, unbounded) | high |
| D11 | Minimum data? | At least 3 Logged Days in the week, checked by the card (from daily totals) and again by the route | Any Entry (tips from one meal mislead); 5 Days (too strict for casual loggers) | medium |
| D12 | Who works out "last week"? | The browser sends the week's first Day (it knows the User's today); the route checks it falls on the day the User's week starts on (from their settings), that its 7 Days end on or before today in Sydney (ADR 0004: Planned Entries never count as eaten), and that it starts no more than 14 Days ago | The server computes it alone (it has no reliable "today" for the User: a Day is as the User experiences it, `CONTEXT.md`); trusting the browser (a crafted request could ask about any week) | medium |
| D13 | Are tips stored? | Yes, in Slice 2: one row per User per week in `nutrition_tips`, RLS to the owner, replaced by Ask again | Not stored (every reopen spends quota); stored forever per request (history nobody asked for) | medium |
| D14 | How does the route read Entries? | With the User's own Supabase client (RLS applies), summing Quantity per Food for the week | Service role (needless privilege) | high |
| D15 | How do tests avoid Gemini? | A `FakeTipsWriter`, chosen by `NUTRITION_TIPS=fake` in Playwright's web server env, or by having no key outside production, as `CALORIE_GUESSER` does | Mocking HTTP (brittle) | high |
| D16 | What does About say? | "Photos and best guesses" also mentions Nutrition tips while the Toggle is on, because Food names go to Google's free tier | No mention (Users should know what leaves the app) | high |
| D17 | Slices? | Two, by user story: get tips (Toggle, route, card, limit, About); keep tips (table, read, Ask again) | One Slice (larger, mixes the Gemini risk with the RLS risk) | medium |

## Risk Assessment *(mandatory)*

| Condition | Yes/No | Why | Slices affected |
|---|---|---|---|
| Adds a third-party integration, secret, environment variable or dashboard step | Yes | A new use of the existing Gemini integration: Users' Food names and Quantities go to Google's free tier. No new secret; one test-only variable, `NUTRITION_TIPS=fake`, in Playwright's web server env | 1 |
| Irreversible: drops or renames a column or table, or rewrites or deletes User data | No | Additive migrations only: a Toggle row and a new table | |
| Cannot be proved in CI (real device, real external API, Gemini or Google Health) | Yes | Whether real Gemini tips are sensible and stay within the prompt's rules (add foods only; no calories, weight, supplements or conditions) can only be seen by trying it: the Owner turns the Toggle on in production and gets tips for a real week before the Requester tries it | 1 |
| Touches sign-in, RLS policies or what one User can see of another | Yes | New table `nutrition_tips` with RLS policies | 2 |
| Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow) | No | | |
| Contradicts an ADR or needs a new one | No | Follows ADR 0001, 0003 and 0008 | |
| Size L or XL | No | Two Slices on existing Gemini, Summary and AI-usage code | |

**Size**: M

**Human review**: Needed for the spec and Slices 1 and 2
