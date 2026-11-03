// Writes .env.local pointing the app at the local Supabase stack (pnpm db:start first).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

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

writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\n`,
);
console.log("Wrote .env.local for the local Supabase stack.");
