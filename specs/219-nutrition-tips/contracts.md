# Contracts: Nutrition tips for last week

## `POST /api/nutrition-tips` (new route handler)

Request body (from the browser, untrusted):

```ts
{ weekStart: string } // "YYYY-MM-DD", the first Day of last week as the browser computes it
```

Responses (all `Cache-Control: no-store`):

| Status | Body | When |
|---|---|---|
| 200 | `{ tips: { nutrient: string; tip: string }[] }` (1–3) | tips written (and, from Slice 2, kept) |
| 400 | `{ code: "bad_request" \| "bad_week" }` | not JSON; not a date, or `weekStart + 6` is after today in Sydney plus one Day |
| 401 | `{ code: "unauthorized" }` | no session |
| 404 | `{ code: "not_found" }` | Toggle `feature-218` is off for the User |
| 422 | `{ code: "not_enough_days" }` | fewer than 3 Logged Days in the week |
| 429 | `{ code: "limit_reached" }` | 3 uses of kind `tips` today already |
| 503 | `{ code: "tips_unavailable" }` | Gemini out of quota, down or too slow (`AiUnavailable`) |
| 500 | `{ code: "tips_failed" }` | anything else, including an answer with no usable tip |

Steps, in order (pseudocode):

```text
if no user: 401
if not isToggleOn("feature-218"): 404
parse weekStart; if bad: 400 bad_week
rows = entries joined to foods, day between weekStart and weekStart+6, with the User's client (RLS)
if distinct days < 3: 422 not_enough_days          -- before spending the allowance
if not increment_ai_usage("tips", 3): 429
summary = per Food: name, portion, calories, sum(quantity); top 80 by calories; loggedDays
answer = writer.write(summary)                      -- Gemini, or the fake
tips = tidy(answer); if none: 500 tips_failed
(Slice 2) upsert nutrition_tips (user, weekStart, tips); a failed save is logged, tips still returned
200 { tips }
```

## `TipsWriter`

```ts
type WeekSummary = {
  loggedDays: number;
  foods: { name: string; portion: string; calories: number; quantity: number }[];
};
type NutritionTip = { nutrient: string; tip: string };
interface TipsWriter { write(week: WeekSummary): Promise<NutritionTip[]> }
```

- `GeminiTipsWriter` sends a system prompt (US1.6) and one text input listing the Foods, asks for `{ tips: NutritionTip[] }` as JSON schema, and parses it with zod.
- `FakeTipsWriter` returns two fixed tips (for tests and local development without a key).
- `getTipsWriter(env)`: `NUTRITION_TIPS=fake` → fake; `GEMINI_API_KEY` → Gemini with `GEMINI_LIGHT_MODEL`; not production → fake; else a writer that throws `AiUnavailable`.

## Kept tips read (Slice 2)

The card reads its own row with the browser Supabase client: `from("nutrition_tips").select("tips, created_at").eq("week_start", weekStart).maybeSingle()`, under `nutritionTipKeys.week(weekStart)`. A successful POST sets that query's data.
