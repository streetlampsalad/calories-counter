// Fails if a server-only secret could have reached the browser (spec 006, AC-9). Everything the
// browser can download lives in .next/static, so look there for the secret's name and for the shape of
// a Google API key. Run after `pnpm build` (validate does).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".next/static";
const FORBIDDEN = [
  { what: "the name GEMINI_API_KEY", pattern: /GEMINI_API_KEY/ },
  { what: "a Google API key (AIza…)", pattern: /AIza[0-9A-Za-z_-]{35}/ },
  {
    what: "the name SUPABASE_SERVICE_ROLE_KEY",
    pattern: /SUPABASE_SERVICE_ROLE_KEY/,
  },
  // The Reminder scheduler's secrets (spec 016). The VAPID *public* key is meant to ship.
  { what: "the name SUPABASE_SECRET_KEY", pattern: /SUPABASE_SECRET_KEY/ },
  { what: "the name VAPID_PRIVATE_KEY", pattern: /VAPID_PRIVATE_KEY/ },
  { what: "the name REMINDER_SECRET", pattern: /REMINDER_SECRET/ },
];

function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

let scanned = 0;
const problems = [];
for (const file of files(ROOT)) {
  if (!/\.(js|css|html|json|map|txt)$/.test(file)) continue;
  scanned += 1;
  const text = readFileSync(file, "utf8");
  for (const { what, pattern } of FORBIDDEN) {
    if (pattern.test(text)) problems.push(`${file} contains ${what}`);
  }
}

if (scanned === 0) {
  console.error(`Nothing to check in ${ROOT}. Run pnpm build first.`);
  process.exit(1);
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `No server secrets in the ${scanned} files the browser can download.`,
);
