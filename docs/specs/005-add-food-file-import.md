# 005: Add Food: file import and Import Review

- **Status**: Ready
- **Depends on**: 004
- **Tracking issue**: [#20](https://github.com/streetlampsalad/calories-counter/issues/20)

## Goal

A User can turn a page of handwritten food notes into Foods without typing each one. They copy a ready-made prompt from the app, give it and a photo to any AI chat (Gemini, ChatGPT and so on), then upload the CSV or JSON it produces, or paste it straight in. Every row lands in **Import Review**, where they fix, skip or confirm rows before saving them all at once. Photo import (006) feeds the same review screen.

## User stories

- As a User, I want a prompt I can copy with one tap, so the AI gives me a file the app accepts first time.
- As a User on a phone, I want to paste the AI's answer instead of saving a file, because files are awkward on Android.
- As a User, I want to review every row before saving, so a misread number never enters my list unnoticed.

## Acceptance criteria

- **AC-1**: Given I tap **Add food → Import from notes**, then I see the three steps (copy the prompt, ask any AI with your photo, upload or paste the result), the full prompt text, and a **Copy prompt** button.
- **AC-2**: Given I tap **Copy prompt**, then the exact prompt text is on my clipboard and I see "Prompt copied". If clipboard access fails, the prompt text is selected so I can copy it by hand.
- **AC-3**: Given a CSV with a header row `name,portion,calories` (columns in any order, header case-insensitive, an optional `kilojoules` column, quoted fields with commas, a UTF-8 BOM, CRLF or LF line endings), when I upload or paste it, then each data row becomes a Suggestion in Import Review.
- **AC-4**: Given JSON shaped as `[{ "name", "portion", "calories" | "kilojoules" }]` or `{ "foods": [...] }`, when I upload or paste it, then each item becomes a Suggestion. Pasted text wrapped in a Markdown code fence is accepted.
- **AC-5**: Given a row has `kilojoules` but no `calories`, then its Calories are converted with spec 004's `kilojoulesToCalories`, and the row shows the original "(from 1,000 kJ)".
- **AC-6**: Given a row is invalid (missing name, missing energy, or out of bounds), then it appears in Import Review flagged with the reason, switched off, and can be fixed inline, after which it switches on.
- **AC-7**: Given a row's name and Portion match an existing Food, then it is flagged "Already in your list (N kcal)", with a choice of **Skip** (the default) or **Update existing**. Two identical rows within one Import are merged into one.
- **AC-8**: Given I tap **Save N foods**, then every switched-on row is saved in one transaction. Updated Foods change history per ADR 0001. I return to the Food List with a toast: "Added X, updated Y".
- **AC-9**: Given the save fails, then nothing is saved and Import Review keeps all my edits so I can retry.
- **AC-10**: Files over 1 MB or with more than 200 rows are rejected before parsing, with a message saying so. Files that aren't CSV or JSON are rejected with the expected formats spelled out.
- **AC-11**: Given I leave Import Review with unsaved rows, then I am asked to confirm discarding them.

## Out of scope

- The in-app photo reading (spec 006).
- Exporting the Food List.

## Design

**The AI prompt**
Stored as a constant in `src/features/import/ai-prompt.ts`. A test asserts it matches this text exactly, so any change is deliberate:

```
You are converting a photo of my handwritten food notes into data for a calorie-tracking app used in Australia.

For every food written in the photo, output one row with:
- name: the food's name as written, with spelling corrected, in sentence case (e.g. "Vegemite toast").
- portion: the amount the energy value refers to, in Australian metric terms (e.g. "1 slice", "100 g", "250 ml", "1 cup", "1 piece"). If no amount is written, use "1 serve".
- calories: a whole number of kilocalories (kcal) for that portion. If the note gives kilojoules (kJ), divide by 4.184 and round to the nearest whole number.

Rules:
- Output CSV only, with no explanation and no code fences.
- The first line must be exactly: name,portion,calories
- Wrap any value that contains a comma in double quotes.
- If you cannot read a food's energy value, still include the row and leave calories empty.
- Only include foods that are actually written in the photo.
```

**Parsing** happens on the client, in pure functions:
- `parseImportText(text): ImportRow[]` sniffs JSON or CSV, removing any code fence and BOM.
- `validateImportRow(row): Suggestion | RowError` applies spec 003's validation rules and spec 004's kJ conversion.

**Import Review state** is a reducer (`importReducer`) over `ImportRow[]`. Actions: edit, toggle, choose duplicate action, add rows (used by 006), reset. It holds no server state until save.

**Save** goes through one RPC, `import_foods(rows jsonb)` (security invoker, so RLS applies). It inserts new Foods and updates the chosen duplicates in a single transaction, and returns the counts (AC-8, AC-9).

**Screens**: `/foods/import` with three regions (prompt, upload or paste, the review list). Each review row is a compact card with name, Portion and Calories fields, a keep switch, and a flag line for errors or duplicates. A sticky **Save N foods** button sits above the bottom nav.

## Test plan

- Vitest is the main layer here:
  - `parseImportText` over a fixture folder (`src/features/import/fixtures/`) covering every AC-3 and AC-4 variant, with malformed inputs that produce useful errors.
  - `validateImportRow` (AC-5, AC-6).
  - `importReducer`, including duplicate merging (AC-7).
  - The prompt snapshot.
- pgTAP: `import_foods` is all-or-nothing on a bad row (AC-9), respects RLS, and updates only the caller's Foods.
- Testing Library: copy-prompt success and fallback (AC-2), and the leave-confirm dialog (AC-11).
- Playwright: paste a CSV containing one valid, one invalid and one duplicate row → fix the invalid row → save → see the Foods in the list (AC-3, AC-6, AC-7, AC-8).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | Import screen with the prompt and Copy button. Add **Import from notes** to the Add food sheet | AC-1, AC-2 | [#21](https://github.com/streetlampsalad/calories-counter/issues/21) |
| 2 | CSV and JSON parsing and validation with fixtures (pure functions only) | AC-3, AC-4, AC-5, AC-10 | [#22](https://github.com/streetlampsalad/calories-counter/issues/22) |
| 3 | Import Review list with inline fixes and the keep toggle | AC-6, AC-11 | [#23](https://github.com/streetlampsalad/calories-counter/issues/23) |
| 4 | Duplicate detection against the Food List and within the Import | AC-7 | [#24](https://github.com/streetlampsalad/calories-counter/issues/24) |
| 5 | `import_foods` RPC and Save all | AC-8, AC-9 | [#25](https://github.com/streetlampsalad/calories-counter/issues/25) |

## Open questions

The owner accepted every default below on 2026-11-03; treat them as decisions.

- **Should Import Review survive a page reload, for example if Android kills the tab while I'm in the AI app?** Default: yes, keep the reducer state in `sessionStorage` until saved or discarded. This matters on phones where switching apps reloads the page.
