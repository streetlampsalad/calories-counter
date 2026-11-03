# 002: Sign in with Google and the app shell

- **Status**: In progress
- **Depends on**: 001
- **Tracking issue**: [#5](https://github.com/streetlampsalad/calories-counter/issues/5)
- **ADRs**: 0002

## Goal

My friends and I can sign in with our Google accounts and stay signed in. Anyone whose email is not an **Allowed Email** is turned away before an account is created. Signed-in Users land in an app shell with bottom navigation, which later specs fill with tabs.

## User stories

- As a User, I want to sign in with one tap on my Google account, so there's no password to remember.
- As a User, I want to stay signed in for weeks, so opening the app goes straight to logging.
- As the app owner, I want only people I have allowed to get in, so strangers can't use my free-tier quotas.

## Acceptance criteria

- **AC-1**: Given I am signed out, when I open any app route, then I am redirected to `/sign-in`, and after signing in I return to the route I asked for.
- **AC-2**: Given my Google email is an Allowed Email, when I tap **Continue with Google** and approve, then I am signed in and see the app shell.
- **AC-3**: Given my Google email is not an Allowed Email, when I complete Google sign-in, then no User is created and I see "This app is invite-only. Ask the owner to add <email>."
- **AC-4**: Given I am signed in, when I close and reopen the browser or installed app days later, then I am still signed in.
- **AC-5**: Given I am signed in, when I tap **Sign out**, then my session ends and I am back on `/sign-in`.
- **AC-6**: Given I am signed in and visit `/sign-in`, then I am redirected to `/`.
- **AC-7**: The Allowed Email table cannot be read or changed through the API by any User. pgTAP proves this for `anon` and `authenticated`.
- **AC-8**: The app shell shows a bottom navigation bar fixed above the Android gesture area, with only the tabs whose features have shipped. In this spec that means **Today** (a placeholder) and **Settings** (with Sign out). Tabs are at least 56 px tall with icon and label.

## Out of scope

- Email, password, magic-link or one-time-code sign-in in production (ADR 0002).
- An admin screen for Allowed Emails. For now the owner inserts rows with SQL in the Supabase dashboard.
- Account deletion.

## Design

**Supabase configuration** (human, done once in the dashboard, recorded in the issue):
- Create a Google Cloud OAuth client (Web application). Its authorised redirect URI is `https://xrfbpeiugmacbossropu.supabase.co/auth/v1/callback`.
- Enable the Google provider in Supabase, disable the Email provider, and turn off "Allow new users to sign up" for email.
- Site URL: the production URL. Redirect URLs: the production URL plus `/auth/callback`, and `http://127.0.0.1:3000/auth/callback`.
- JWT expiry stays at the default, and refresh tokens don't expire, so sessions last until sign-out (AC-4).

**Allowed Emails**
- Migration: `allowed_emails (email text primary key check (email = lower(email)), note text, created_at timestamptz default now())`.
- RLS is enabled with a single `using (false)` policy, so nothing is reachable through the API (AC-7). This also satisfies the guardrail test.
- Postgres function `public.hook_before_user_created(event jsonb)`, `security definer`. It returns an error (HTTP 403, AC-3 message) unless `lower(event->'user'->>'email')` is in `allowed_emails`. Register it as the **Before User Created** auth hook in the dashboard, and in `supabase/config.toml` (`[auth.hook.before_user_created]`) for local. *Verify during implementation that this hook type is available on the Free plan. If it isn't, fall back to checking the allowlist in `/auth/callback` and deleting the just-created user through an `auth.admin` call from the server.*

**Next.js**
- `src/proxy.ts` (Next 16's replacement for middleware) refreshes the Supabase session cookie on every request and redirects according to AC-1 and AC-6. Public routes: `/sign-in`, `/auth/callback`, `/api/health`. Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` first.
- `/sign-in` calls `signInWithOAuth({ provider: "google", options: { redirectTo: <origin>/auth/callback?next=<path> } })`.
- `/auth/callback` route handler calls `exchangeCodeForSession` and redirects to `next`. It only accepts relative paths, so it can't become an open redirect. On an auth error it redirects to `/sign-in?error=…`, which shows the AC-3 message.
- App shell: `src/app/(app)/layout.tsx` with `BottomNav`. Each later spec adds its own tab in its final issue (ADR 0003).

**Local and E2E authentication**
Google can't be automated. Locally only:
- `config.toml` enables the email provider with sign-up disabled.
- `supabase/seed.sql` creates two Users with passwords and Allowed Emails: `ada@example.test` and `bea@example.test`.
- A Playwright `globalSetup` signs each one in with `signInWithPassword`, writes the Supabase session cookies into a `storageState` file per User, and tests run as `ada` by default.

No test-only route or button ships in the production bundle. A unit test asserts that `/sign-in` renders only the Google button.

## Test plan

- pgTAP:
  - `allowed_emails` is unreachable by `anon` and `authenticated` (AC-7).
  - The hook function rejects a non-allowed email, accepts an allowed one, and matches without regard to case (AC-2, AC-3).
- Vitest: callback `next` sanitising, so `//evil.com` and `https://…` fall back to `/`.
- Playwright:
  - Signed out → redirect to `/sign-in` → (stored session) → original route (AC-1).
  - Sign out (AC-5).
  - `/sign-in` while signed in (AC-6).
  - Bottom nav visible with two tabs, no horizontal scroll (AC-8).
  - `/sign-in?error=…` shows the invite-only message (AC-3 UI).
- Manual check, recorded in the issue: a real Google sign-in on an Android phone against production, for an allowed and a non-allowed account (AC-2, AC-3, AC-4).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | Local auth harness: seed Users, Playwright `globalSetup` and storage states | prerequisite for E2E | [#6](https://github.com/streetlampsalad/calories-counter/issues/6) |
| 2 | Proxy session refresh, redirects, and the `/sign-in` page with the Google button and `/auth/callback` | AC-1, AC-6 | [#7](https://github.com/streetlampsalad/calories-counter/issues/7) |
| 3 | Allowed Emails table and Before User Created hook, with pgTAP | AC-3, AC-7 | [#8](https://github.com/streetlampsalad/calories-counter/issues/8) |
| 4 | App shell with bottom navigation, Today placeholder and Settings with Sign out | AC-5, AC-8 | [#9](https://github.com/streetlampsalad/calories-counter/issues/9) |
| 5 | Production Google provider setup (human) and the manual Android check | AC-2, AC-4 | [#10](https://github.com/streetlampsalad/calories-counter/issues/10) |

## Open questions

The owner accepted every default below on 2026-11-03; treat them as decisions.

- **Should Google show the account chooser every time, or reuse the last account?** Default: reuse the last account (no `prompt=select_account`), since each phone has one person.
