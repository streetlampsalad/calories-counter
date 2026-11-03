// Generates TypeScript types from the local Supabase schema.
//   --write  overwrite src/lib/supabase/database.types.ts
//   --check  fail if the committed file differs from the schema (used by validate)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TARGET = "src/lib/supabase/database.types.ts";
const mode = process.argv[2];

if (mode !== "--write" && mode !== "--check") {
  console.error("Usage: node scripts/db-types.mjs --write | --check");
  process.exit(2);
}

const generated = execFileSync(
  "pnpm",
  [
    "exec",
    "supabase",
    "gen",
    "types",
    "typescript",
    "--local",
    "--schema",
    "public",
  ],
  { encoding: "utf8", shell: process.platform === "win32" },
).replace(/\r\n/g, "\n");

if (mode === "--write") {
  writeFileSync(TARGET, generated);
  console.log(`Wrote ${TARGET}`);
  process.exit(0);
}

const committed = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
if (committed !== generated) {
  console.error(
    `${TARGET} is out of date with the database schema. Run: pnpm db:types`,
  );
  process.exit(1);
}
console.log(`${TARGET} matches the schema.`);
