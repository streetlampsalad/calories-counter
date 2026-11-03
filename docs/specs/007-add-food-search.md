# 007: Add Food: search and best guess

- **Status**: Draft
- **Depends on**: 004

## Goal

A User types a food ("banana", "Arnott's Tim Tam") and gets Suggestions from free Australian sources. They pick one, adjust the Portion, and save it as a Food. When nothing fits, **Best guess** asks Gemini for an estimate in Australian Portions, labelled as an estimate.

## User stories

- As a User, I want generic foods with trustworthy Australian values, so my basics are accurate.
- As a User, I want packaged products sold in Australia, so I can add what's in my pantry.
- As a User, I want to say "1 cup" or "150 g" and have the Calories scale, so the Food matches how I actually eat it.

## Acceptance criteria

- **AC-1**: Given I tap **Add food → Search** and submit a query of at least 2 characters, then I see Suggestions in labelled sections: **Australian foods** (Reference Foods) and **Packaged products** (Open Food Facts, Australian products only).
- **AC-2**: Reference Food search returns results within 300 ms on the server. It matches without regard to case, tolerates typos (pg_trgm), and ranks prefix matches first.
- **AC-3**: Open Food Facts is queried only on submit, not on every keystroke, through the server. Results show product name, brand, and energy per 100 g (and per serving when available). A failure or timeout after 5 s hides that section with "Packaged products unavailable right now", while Reference Foods still show.
- **AC-4**: Given I pick a Suggestion that has values per 100 g, then spec 004's Food form opens prefilled with the name, Portion "100 g", the Calories, and a source label. If I change the Portion to a gram or ml amount (for example "150 g"), the Calories rescale (165 kcal per 100 g → 248 kcal), and I can still override the number.
- **AC-5**: Given a Suggestion with a serving size (for example "Serving 30 g, 150 kcal"), then I can choose **Per serving** or **Per 100 g** before the form opens.
- **AC-6**: Values supplied only in kJ are converted with `kilojoulesToCalories` (spec 004).
- **AC-7**: Given I tap **Best guess** for my query, then the server asks Gemini for one Suggestion (name, an Australian Portion, Calories and a one-line basis note), and the form opens labelled "Estimate: check before saving".
- **AC-8**: **Best guess** shares spec 006's per-User daily AI limit (as a separate `kind`, 30 per Day) and its unavailable handling. Search still works when Gemini is down.
- **AC-9**: Given the query matches a Food already in my Food List, then a **Your foods** section appears first, linking to that Food instead of creating a duplicate.
- **AC-10**: Attribution for AFCD (FSANZ) and Open Food Facts is shown under the results and in Settings → About, as their licences require.

## Out of scope

- USDA or other non-Australian databases.
- Barcode scanning. That's a natural follow-up using Open Food Facts' barcode lookup.
- Nutrients other than energy.

## Design

**Reference Foods (AFCD)**
- Source: Food Standards Australia New Zealand's Australian Food Composition Database. Download the current release's food details and nutrient files. *While implementing, confirm the licence (expected to be CC BY 4.0) and the exact attribution text.*
- Table: `reference_foods (id, source text, source_id text, name text, energy_kj_per_100 numeric, calories_per_100 integer, unit text check (unit in ('g','ml')))`, with a GIN trigram index on `name`. It is shared read-only: RLS select for `authenticated` and no write policies.
- Loading: `scripts/afcd/build-seed.mjs` turns the downloaded files into `supabase/seeds/reference_foods.sql`. That file is committed and loaded locally through `config.toml` `[db.seed]`. Production is loaded by a data migration that inserts the same rows, so the data is versioned and reviewable.
- Search: `search_reference_foods(q text, max int default 20)` (security invoker) using `similarity` and `ilike 'q%'` ranking.

**Open Food Facts**
- `GET /api/search/products?q=` (server) calls the Open Food Facts search API, filtered to Australian products, requesting only the fields needed (`product_name`, `brands`, `nutriments.energy-kcal_100g`, `energy-kj_100g`, `energy-kcal_serving`, `serving_size`).
- It sends the `User-Agent` Open Food Facts requires (`CaloriesCounter/1.0 (<owner contact>)`), caches responses for 1 hour, and stays within Open Food Facts' published rate limits. *Check the current API version and limits during implementation.*

**Best guess**
- `POST /api/search/guess` (server) uses a `CalorieGuesser` interface with `GeminiCalorieGuesser` and `FakeCalorieGuesser` (the same pattern and model as spec 006's `NotesReader`).

**Portion scaling** is a pure function, `scaleCalories(per100: number, amount: number)`, plus `parseMetricPortion("150 g") → { amount: 150, unit: "g" } | null`. Portions that aren't metric ("1 cup") don't rescale automatically, and the User enters the Calories.

**Suggestion → Food** goes through spec 004's `FoodForm` with `initialValues` and `sourceLabel`.

## Test plan

- Vitest:
  - `parseMetricPortion` and `scaleCalories` (AC-4).
  - The Open Food Facts response mapper over recorded fixtures, including kJ-only products (AC-3, AC-6).
  - Route handlers with fake HTTP and guesser: timeout hides the section (AC-3), guesser unavailable (AC-8).
- pgTAP:
  - `search_reference_foods` ranking and typo tolerance over a small fixture seed (AC-2).
  - `reference_foods` is read-only for Users.
- Playwright, with fakes enabled: search → pick a Reference Food → change the Portion to 150 g → save (AC-1, AC-4). **Your foods** shows first for an existing Food (AC-9).
- No test calls Open Food Facts or Gemini over the network.

## Issue breakdown

| # | Slice | Covers |
|---|---|---|
| 1 | `reference_foods` table, AFCD seed build script, data migration and search function | AC-2, AC-10 (data) |
| 2 | Search screen with **Your foods** and **Australian foods**, and pick → prefilled `FoodForm`. Add **Search** to the Add food sheet | AC-1, AC-4, AC-9 |
| 3 | Portion scaling and the per-serving or per-100 g choice | AC-4, AC-5, AC-6 |
| 4 | Open Food Facts search route and the **Packaged products** section | AC-3, AC-6 |
| 5 | Best guess route, Gemini guesser and the estimate label | AC-7, AC-8 |
| 6 | Attribution in results | AC-10 |

## Open questions

- **Should search query Open Food Facts automatically, or only when I tap "Search packaged products"?** Default: automatically on submit, in parallel with Reference Foods.
