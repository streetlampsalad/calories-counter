# Reminders are Web Push, scheduled from the database

A Reminder is a standard Web Push message (VAPID keys, the `web-push` library) sent by a Next.js route handler. Supabase `pg_cron` calls that route every 15 minutes through `pg_net`, and the route asks the database which Users are due. We chose this because a page can't fire a notification on time once Chrome has backgrounded it, Vercel's Hobby plan runs cron jobs only once a day at an imprecise time, and `pg_cron` is free on Supabase and already sits next to the data that decides who is due.

## Considered Options

- **Firebase Cloud Messaging SDK**: the Supabase push guide uses it, but that guide is for native apps. On Chrome, plain Web Push is already delivered through FCM, so the SDK would add a Firebase project, a second service worker and a service-account key for no gain. Revisit if the app ever ships as a native or Trusted Web Activity app.
- **Vercel cron**: once a day on Hobby, so it can't honour a chosen time.
- **A Supabase Edge Function that sends the push**: keeps the secret key out of Vercel, but adds a second deploy target and runtime for one feature.
- **Periodic Background Sync or in-page timers**: unreliable, so a Reminder could silently never arrive.

## Consequences

- The route needs a server-only Supabase secret key to read every User's due Reminders. It's guarded by a shared scheduler secret and calls one `security definer` function that only `service_role` may execute.
- The cron job reads the route's URL and secret from Supabase Vault. A human sets them in each environment, so local and CI databases schedule nothing unless configured.
- Reminder times are in 15-minute steps, and a Reminder can arrive up to 15 minutes late.
- Each User's time zone is stored with their Reminder, and it is the only place the app stores a time zone. Days themselves stay plain dates (spec 008 AC-8).
