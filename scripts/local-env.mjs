// Writes .env.local pointing the app at the local Supabase stack (pnpm db:start first).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import webpush from "web-push";

const status = JSON.parse(
  execSync("pnpm exec supabase status --output json", { encoding: "utf8" }),
);

const url = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!url || !key) {
  console.error(
    "Could not read API_URL / PUBLISHABLE_KEY from `supabase status`.",
  );
  process.exit(1);
}

// Reminders (spec 016): the secret key lets the send route read every User's due Reminders, and
// throwaway VAPID keys let the app subscribe. Nothing here ever reaches a real push service.
const secretKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
const vapid = webpush.generateVAPIDKeys();

writeFileSync(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}`,
    `SUPABASE_SECRET_KEY=${secretKey}`,
    "REMINDER_SECRET=local-scheduler-secret",
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapid.publicKey}`,
    `VAPID_PRIVATE_KEY=${vapid.privateKey}`,
    "VAPID_SUBJECT=mailto:dev@example.test",
    "",
  ].join("\n"),
);
console.log("Wrote .env.local for the local Supabase stack.");
