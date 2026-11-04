# 018: Calories Burned from Google Health

- **Status**: Draft (waiting on the spike in slice 1)
- **Depends on**: 017
- **Tracking issue**: [#93](https://github.com/streetlampsalad/calories-counter/issues/93)
- **ADRs**: 0002

## Goal

A User who tracks Calories Burned (spec 017) can connect their Google Health account. Their Fitbit's daily total then fills in Calories Burned on its own, so they never have to type it. Connecting is optional and separate from signing in.

## Known facts (checked 2026-11-04)

- A web app can't read **Health Connect**, which lives on the phone. The cloud route is the **Google Health API** (`https://health.googleapis.com/v4/`), which replaced the Fitbit Web API when that shut down on 2 November 2026.
- `total-calories` (resting plus activity, which matches Calories Burned) supports `rollUp` and `dailyRollUp`. `dailyRollUp` returns `rollupDataPoints[]` with `civilStartTime` and `civilEndTime`, and `total-calories` ranges are capped at 14 Days. `dataSourceFamily` can be `all-sources`, `google-wearables` (Fitbit and Pixel devices, without manual entries) or `google-sources`.
- The scope is `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`. **Every Google Health API scope is Restricted**, so wider release needs a privacy and security review, and possibly a CASA security assessment.
- Webhooks exist, but `total-calories` isn't among the webhook data types, so syncing has to pull.
- The API is pre-GA, with a public beta on Google's roadmap for Q4 2026.
- The owner has enabled the Google Health API in the Google Cloud project that holds the app's existing OAuth client.

Sources:
- [Google Health API](https://developers.google.com/health)
- [Data types](https://developers.google.com/health/data-types)
- [Scopes](https://developers.google.com/health/scopes)
- [dailyRollUp](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/dailyRollUp)
- [User data policy](https://developers.google.com/health/policies/health-api-developer-user-data-policy)

## User stories

- As a User with a Fitbit, I want my Calories Burned filled in for me, so the Deficit just appears.
- As a User, I want to disconnect Google Health at any time.

## Acceptance criteria (provisional)

- **AC-1**: With **Track calories burned** on, Settings offers **Connect Google Health**. It asks Google for the read-only activity scope only, through a separate consent and not at sign-in, and it explains in the app what is read and why (Google's Limited Use policy).
- **AC-2**: Once connected, Calories Burned for today and the previous 13 Days fills in from Google Health's daily `total-calories` whenever I open Today or the Summary, at most once every 15 minutes.
- **AC-3**: A value I entered by hand for a Day is never overwritten by a synced value. The Burned row shows where each value came from.
- **AC-4**: Given my Google connection expires or is revoked, then Settings shows **Reconnect**, and my existing values stay.
- **AC-5**: **Disconnect** revokes the token with Google and deletes it. Synced values are kept.
- **AC-6**: Tokens are stored only on the server, encrypted, and never reach the browser. No other User can read them (pgTAP).

## Out of scope

- Workouts and exercise sessions, steps, sleep and heart rate.
- Writing data back to Google Health.
- Webhooks, until `total-calories` supports them.

## Design

Sketch only. The spike decides the details.

- `health_connections (user_id pk, refresh_token_encrypted, scope, connected_at, last_synced_at, status)`. Only the server reads or writes it, through the admin client from spec 016.
- `calories_burned` gains `source text not null default 'manual' check (source in ('manual', 'google_health'))`. A sync upserts only where the source isn't `manual` (AC-3).
- `POST /api/health/sync` refreshes the access token, calls `dailyRollUp` for `total-calories` over the last 14 civil Days, and upserts the results.
- An OAuth route pair, `/api/health/connect` and `/api/health/callback`, uses `access_type=offline` and `prompt=consent`, without `include_granted_scopes`.

## Test plan

To be written after the spike.

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | **Spike**: connect one Fitbit User to the Google Health API from a throwaway script. Record the answers to every open question below in this spec. No production code | — | [#94](https://github.com/streetlampsalad/calories-counter/issues/94) |

Further slices are added once the spike's findings make this spec Ready.

## Open questions

These are for the spike to answer. The defaults apply if it can't settle them.

- **Can a handful of Users connect without Google's full review?** For example, through "Testing" publishing status with listed test users. How long do refresh tokens last there (7 days is typical for testing)? Default: if they'd have to reconnect weekly, ship it only if the owner accepts that.
- **How are civil Days mapped to time zones?** Does a `dailyRollUp` Day match the User's local Day in Australia?
- **What do `TotalCaloriesRollupValue`'s fields and units look like?** kcal, or something to convert?
- **Which `dataSourceFamily` should be used?** Default: `all-sources`, so Google Health app entries count too.
- **What are the rate limits, and is the API available in Australia?**
- **Can it share the Google OAuth client used for Supabase sign-in, or does it need its own client?** Default: share it, with the redirect URI added.
