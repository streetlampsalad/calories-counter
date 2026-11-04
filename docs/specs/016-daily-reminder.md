# 016: Daily Reminder

- **Status**: In progress
- **Depends on**: 009, 012
- **Tracking issue**: [#84](https://github.com/streetlampsalad/calories-counter/issues/84)
- **ADRs**: 0004, 0005

## Goal

A User can choose a time of day for a **Reminder**. If they haven't logged anything by then, their phone shows a notification prompting them to log their food. They don't need the app open, and if they've already logged, the phone stays quiet.

## User stories

- As a User who forgets to log, I want a nudge in the evening, so my Days don't go unlogged.
- As a User who has already logged, I don't want to be pestered.
- As a User, I want to pick the time, because my evenings differ from my friends'.

## Acceptance criteria

- **AC-1**: Given I open **Settings**, then I see a **Reminder** section with a switch, off by default. With it on, I also see the Reminder time, which defaults to 7:00 pm and can be set in 15-minute steps.
- **AC-2**: Given I turn the Reminder on, then Android asks for notification permission:
  - If I allow it, this device is subscribed and the Reminder is saved.
  - If I refuse, or have refused before, the switch stays off and says "Notifications are blocked for this app in Android settings."
  - On a device that can't receive push notifications, the section says "This device can't show reminders" and the switch is disabled.
- **AC-3**: The Reminder belongs to the User, not the device. Its on/off state, its time and my device's time zone at the moment I set it are saved to my settings. Every device I've turned it on from receives it. Changing the time on one device changes it for all of them.
- **AC-4**: Given my Reminder is on for 7:00 pm, when it is between 7:00 pm and 7:15 pm in my saved time zone and today (in that time zone) has no Entries, then each subscribed device shows a notification titled **"Nothing logged today"** with the body "Tap to log what you've eaten."
- **AC-5**: Given today has at least one Entry when the Reminder is due, including a Planned Entry whose Day is today (ADR 0004), then no notification is sent.
- **AC-6**: I get at most one Reminder per Day, even if the scheduler runs again or I move the time later after it was sent.
- **AC-7**: Given I tap the notification, then the installed app opens on Today. If the app is already open, it comes to the front and shows Today.
- **AC-8**: Given I turn the Reminder off on any device, then no device receives it. Given I sign out on a device, then that device's subscription is removed. A subscription the push service reports as expired (HTTP 404 or 410) is deleted.
- **AC-9**: Reminder times follow the saved time zone across daylight-saving changes: a 7:00 pm Reminder in `Australia/Sydney` arrives at 7:00 pm local time both before and after the October change.
- **AC-10**: A User can never read or change another User's push subscriptions (pgTAP). The function that lists due Reminders can't be executed by `anon` or `authenticated` (pgTAP).
- **AC-11**: The send route rejects a request without the correct scheduler secret with 401, and it never sends a notification in response to a browser request.

## Out of scope

- More than one Reminder a day, or choosing which weekdays it fires.
- Reminder text that changes with what's logged, such as "You've logged 2 meals."
- iOS. Safari supports push only for home-screen apps, and every current User is on Android (ADR 0002).
- In-app notification history.

## Design

**Schema** (one migration that adds only; the deployed app ignores the new columns)

```
alter table user_settings
  add column reminder_enabled boolean not null default false,
  add column reminder_time time not null default '19:00'
    check (extract(minute from reminder_time)::int % 15 = 0 and extract(second from reminder_time) = 0),
  add column time_zone text,                     -- IANA name from the device, e.g. Australia/Sydney
  add column reminder_last_sent_on date;         -- the User's local Day it was last sent (AC-6)

push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
)
```

- RLS on `push_subscriptions`: select, insert and delete where `user_id = auth.uid()`.
- Validate `time_zone` with a check that it's in `pg_timezone_names`, or a trigger if a check can't query a catalog.
- `due_reminders(at timestamptz)`: `security definer`, revoked from `public`, `anon` and `authenticated`, and granted to `service_role`. For each User with `reminder_enabled`, it computes `local = at at time zone time_zone`. The User is due when all of these hold:
  - the 15-minute slot containing `local::time` equals `reminder_time`,
  - `reminder_last_sent_on is distinct from local::date`,
  - there's no Entry for that User on `local::date`.

  It returns `user_id`, `local_day`, and each subscription's `id`, `endpoint`, `p256dh` and `auth`. pgTAP tests it with fixed `at` values, including Sydney's daylight-saving change (AC-4, AC-5, AC-6, AC-9).

**Scheduler** (ADR 0005)
- A migration enables `pg_cron` and `pg_net` and schedules `*/15 * * * *` to call `net.http_post`.
- The call's URL and the `x-scheduler-secret` header come from Vault secrets `reminder_url` and `reminder_secret`. When those aren't set (local, CI), the job does nothing.

**Send route**: `POST /api/reminders/send` (a Node runtime route handler)
- Compares the header to `REMINDER_SECRET` in constant time and returns 401 on a mismatch (AC-11).
- Uses a new server-only admin client, `src/lib/supabase/admin.ts`, with `SUPABASE_SECRET_KEY`, which must never be imported into client code. It calls `due_reminders(now())` and sends each subscription a payload with `web-push` and the VAPID keys.
- Deletes subscriptions that return 404 or 410, and sets `reminder_last_sent_on` for every User it sent to.
- Payload: `{ title, body, url: "/" }`.

**Service worker** (`public/sw.js`, spec 012)
- A `push` handler calls `showNotification(title, { body, icon, badge, data: { url } })`.
- `notificationclick` focuses an existing window and navigates it to `/`, or opens one (AC-7).
- Keep spec 012 AC-5: still no caching of API or authenticated responses.

**Client**
- `src/features/settings/reminder-section.tsx` uses a shadcn `switch` and a native `<input type="time" step="900">`.
- `usePushSubscription()` handles `Notification.requestPermission()`, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` and upserting the row.
- The time zone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`, saved whenever the Reminder is turned on or its time changes.
- Settings writes stay optimistic, through `useSettings` (spec 009).
- Sign-out deletes this device's row and calls `subscription.unsubscribe()` (AC-8).

**Environment** (human steps, run through the `wizard` skill)
- Generate VAPID keys. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:`), `REMINDER_SECRET` and `SUPABASE_SECRET_KEY` in Vercel production.
- Set the Vault secrets in the production database.
- Agents can't edit `.env*` files or touch production.

## Test plan

- pgTAP:
  - `push_subscriptions` RLS isolation (AC-10).
  - `due_reminders` with fixed `at` values: due, not yet due, already logged, a Planned Entry for today, already sent today, Reminder off, and both sides of Sydney's daylight-saving change (AC-4, AC-5, AC-6, AC-9).
  - Execute privileges on `due_reminders` (AC-10).
  - The `reminder_time` check.
- Vitest:
  - The send route: rejects a wrong secret, sends to each due subscription, deletes on 410, marks sent. `web-push` and the admin client are stubbed (AC-8, AC-11).
  - The service worker's push and click handlers, extracted as pure functions (AC-4, AC-7).
- Testing Library: the Reminder section's permission granted, denied and unsupported states, the default time, and 15-minute steps (AC-1, AC-2).
- Playwright:
  - With notification permission granted in the browser context: turn the Reminder on, check the subscription row exists, change the time, sign out, check the row is gone (AC-2, AC-3, AC-8).
  - Call the send route with the local secret and check that a push reached the service worker.
- Manual Android check, recorded in the issue: a real Reminder arrives at the chosen time and opens Today (AC-4, AC-7).

## Issue breakdown

| # | Slice | Covers | Issue |
|---|---|---|---|
| 1 | Schema: Reminder settings columns, `push_subscriptions`, and `due_reminders`, with pgTAP | AC-5, AC-6, AC-9, AC-10 | [#85](https://github.com/streetlampsalad/calories-counter/issues/85) |
| 2 | Send route, admin client and service worker push and click handlers. Blocked by 1 | AC-4, AC-7, AC-8 (expired), AC-11 | [#86](https://github.com/streetlampsalad/calories-counter/issues/86) |
| 3 | `pg_cron` schedule and production setup (VAPID keys, secrets, Vault) through a wizard. Blocked by 2 | AC-4 (end to end, manual) | [#87](https://github.com/streetlampsalad/calories-counter/issues/87) |
| 4 | Settings **Reminder** section: permission, subscribe, time, turn off, unsubscribe on sign-out. Blocked by 3. Makes the feature reachable | AC-1, AC-2, AC-3, AC-8 | [#88](https://github.com/streetlampsalad/calories-counter/issues/88) |

## Open questions

The owner accepted every default below on 2026-11-04; treat them as decisions.

- **Push stack?** Standard Web Push with VAPID, not the Firebase SDK (ADR 0005).
- **When does it fire?** Every day at the chosen time, but only if today has no Entries. A Planned Entry for today counts (ADR 0004).
- **How many, and how precise?** One Reminder per User, in 15-minute steps.
- **Copy and default time?** "Nothing logged today" / "Tap to log what you've eaten.", at 7:00 pm.
