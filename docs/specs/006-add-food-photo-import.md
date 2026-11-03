# 006: Add Food: photo of handwritten notes

- **Status**: Draft
- **Depends on**: 005
- **Tracking issue**: [#26](https://github.com/streetlampsalad/calories-counter/issues/26)

## Goal

A User takes a photo of their handwritten food notes in the app, and the rows appear in Import Review (spec 005) a few seconds later, with no separate AI app needed. It runs on the Gemini API's free tier, so it costs nothing. If the free quota runs out, the User is pointed to the copy-prompt route from spec 005.

## User stories

- As a User, I want to snap my notes and get Suggestions, so moving them into the app takes one step.
- As a User with several pages, I want to add more photos to the same Import, so I review everything once.

## Acceptance criteria

- **AC-1**: Given I tap **Add food → Scan notes**, then my phone offers the rear camera or a gallery photo (`<input type="file" accept="image/*" capture="environment">`).
- **AC-2**: Given I choose a photo, then it is resized on the device to at most 1,600 px on its longest side as JPEG before upload, and I see progress text ("Reading your notes…").
- **AC-3**: Given the photo is read, then each food becomes a Suggestion in Import Review with every spec 005 behaviour: validation, kJ conversion, duplicates and Save all.
- **AC-4**: Given I am in Import Review from a photo, when I tap **Add another photo**, then its rows are appended to the same Import.
- **AC-5**: Given the photo contains no readable foods, then I see "Couldn't find any foods in that photo" and can retake it.
- **AC-6**: Given the Gemini free quota is exhausted or the service is unavailable, then I see a message offering **Use an AI app instead**, which opens spec 005's prompt screen. Nothing crashes.
- **AC-7**: The photo is never stored, neither in Supabase Storage nor the database, and its bytes are not logged.
- **AC-8**: Only signed-in Users can call the photo endpoint. Each User is limited to 30 photos per Day, after which they see the AC-6 message.
- **AC-9**: `GEMINI_API_KEY` is read only on the server. The client bundle never contains it (verified by a build-output grep in the test plan).

## Out of scope

- Photos of plated food, with the AI estimating portions.
- Paid Gemini tiers.

## Design

**Server**: `POST /api/import/photo` is a route handler, `runtime = "nodejs"`, with a body limit of 4 MB.
1. Verify the session (401 otherwise).
2. Check and increment the per-User daily count in `ai_usage (user_id, day, kind, count)`. RLS applies, and an RPC `increment_ai_usage(kind, limit)` returns false when over the limit (AC-8).
3. Call the `NotesReader` interface.
4. Return `{ rows: ImportRow[] }`, using the same shape spec 005's parser produces, so Import Review stays agnostic.

**`NotesReader` interface**: `readNotes(image: Uint8Array, mimeType: string): Promise<ImportRow[]>`.
- `GeminiNotesReader` uses `@google/genai` with model `gemini-3.8-flash` and structured output (a JSON schema matching `ImportRow`). Its system instruction is derived from spec 005's AI prompt but asks for JSON instead of CSV. Fetch the current Gemini docs (Image Understanding, Structured Output) before implementing. The SDK's interactions API is the current one, and the `gemini-api-dev` skill has the details.
- Set `store: false` so Gemini does not retain the interaction.
- `FakeNotesReader` returns fixture rows. It is used in tests and when `GEMINI_API_KEY` is absent locally, so `pnpm validate` never calls Google.

**Errors**: Gemini quota and availability errors (429, 503) map to a typed `ReaderUnavailable`. The route returns 503 with `{ code: "reader_unavailable" }`, and the client shows the AC-6 message.

**Free-tier data use**: the owner accepted that Google may use free-tier inputs to improve its products. The Settings "About" section (spec 009) mentions this.

## Test plan

- Vitest:
  - Route handler with `FakeNotesReader`: 401 when signed out, a successful shape, the empty result (AC-5), `ReaderUnavailable` → 503 (AC-6), and over the limit (AC-8).
  - Image resize helper dimensions (AC-2).
  - `GeminiNotesReader` maps a recorded response fixture to `ImportRow[]`.
- pgTAP: `increment_ai_usage` limits per User and per Day, with RLS isolation.
- Playwright, with `FakeNotesReader` enabled through the environment: scan → rows in Import Review → add another photo → rows appended → save (AC-1, AC-3, AC-4).
- A build check in `validate`: `GEMINI_API_KEY` does not appear in `.next/static` (AC-9).
- Manual check, recorded in the issue: three real photos of handwritten notes on an Android phone against production, noting accuracy.

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | `NotesReader` interface, `FakeNotesReader` and the photo route (auth, shape, errors) | AC-5, AC-6, AC-7 | [#27](https://github.com/streetlampsalad/calories-counter/issues/27) |
| 2 | Scan notes UI with resize, progress and hand-off to Import Review. Add **Scan notes** to the Add food sheet | AC-1, AC-2, AC-3, AC-4 | [#28](https://github.com/streetlampsalad/calories-counter/issues/28) |
| 3 | `ai_usage` table and the daily limit | AC-8 | [#29](https://github.com/streetlampsalad/calories-counter/issues/29) |
| 4 | `GeminiNotesReader` with structured output, the key-leak build check, and the production key (human sets `GEMINI_API_KEY` in Vercel) | AC-9, the manual check | [#30](https://github.com/streetlampsalad/calories-counter/issues/30) |

## Open questions

- **Is 30 photos per Day the right limit?** Default: 30. Check the current free-tier limits for `gemini-3.8-flash` while implementing, and set it comfortably below them for the whole group.
