# 012: Installable app

- **Status**: In progress
- **Depends on**: 002
- **Tracking issue**: [#62](https://github.com/streetlampsalad/calories-counter/issues/62)

## Goal

Friends install the app on their Android home screen, and it opens full-screen like a native app, signed in and straight to Today. When there's no signal, it shows a friendly offline screen instead of the browser's error. Full offline logging is out of scope.

## User stories

- As a User, I want an app icon on my home screen, so logging is one tap from anywhere.
- As a User with patchy signal, I want a clear message rather than a broken page.

## Acceptance criteria

- **AC-1**: Given I visit the production site in Chrome on Android, then Chrome offers **Install app**. Once installed, the app opens in standalone mode (no browser bar) with the app's name, icon and theme colour.
- **AC-2**: The web app manifest has `name` "Calories Counter", `short_name` "Calories", `start_url` "/", `display` "standalone", the theme and background colours, and 192 px, 512 px and maskable 512 px icons.
- **AC-3**: Given I sign in with Google from the installed app, then I return to the installed app (not a Chrome tab) signed in. This is a manual check on Android, recorded in the issue.
- **AC-4**: Given I open the installed app with no network, then I see an offline screen ("You're offline. Logging needs a connection.") with **Retry**, served from a service worker cache.
- **AC-5**: The service worker never caches API responses, Supabase requests or authenticated HTML. Only the offline page and static build assets are cached.
- **AC-6**: The layout respects the Android display safe areas in standalone mode: the bottom nav stays clear of the gesture bar, using `env(safe-area-inset-bottom)` and the existing `viewport-fit=cover`.

## Out of scope

- Offline logging and background sync.
- Push notifications.
- App store distribution (a Trusted Web Activity).

## Design

- `src/app/manifest.ts` uses the Next.js metadata route for the manifest. Icons go in `public/icons/`.
- A hand-written service worker, `public/sw.js`, with no extra dependency. It precaches `/offline` and serves it on navigation failure. Register it from a small client component in the root layout, in production only.
- *During implementation, check Chrome's current installability criteria and the Next.js PWA guide in `node_modules/next/dist/docs/` before writing the service worker.*

## Test plan

- Vitest: the manifest route output matches AC-2.
- Playwright:
  - The manifest is linked and valid (AC-2).
  - The service worker registers in a production build.
  - With the browser context set offline, navigating shows the offline screen (AC-4).
  - API requests are not served from the cache (AC-5).
- Manual Android checks: install (AC-1), sign in from standalone (AC-3), safe areas (AC-6).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | Manifest and icons | AC-1, AC-2 | [#63](https://github.com/streetlampsalad/calories-counter/issues/63) |
| 2 | Service worker with the offline screen | AC-4, AC-5 | [#64](https://github.com/streetlampsalad/calories-counter/issues/64) |
| 3 | Standalone polish: safe areas, and the manual Android checks including sign-in | AC-3, AC-6 | [#65](https://github.com/streetlampsalad/calories-counter/issues/65) |

## Open questions

None.
