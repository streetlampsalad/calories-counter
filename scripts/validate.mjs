// The single quality gate. Runs in the pre-push hook and in CI.
//   pnpm validate         full gate (needs local Supabase running: pnpm db:start)
//   pnpm validate --fast  static checks and unit tests only
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const fast = process.argv.includes("--fast");

// The full gate must run against the local Supabase stack and never production. Values already
// in the environment beat every .env file (including a stray .env.production.local that
// `next build` would otherwise prefer), so load the local stack's values up front.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
} else if (!fast) {
  console.error("Missing .env.local. Run: pnpm db:start && pnpm env:local");
  process.exit(1);
}

const steps = [
  { name: "lint", cmd: "pnpm biome ci" },
  { name: "typecheck", cmd: "pnpm typecheck" },
  { name: "unit tests", cmd: "pnpm test" },
  ...(fast
    ? []
    : [
        {
          name: "local Supabase is running",
          cmd: "pnpm exec supabase status",
          hint: "Start it with: pnpm db:start (Docker must be running)",
        },
        { name: "migrations apply cleanly", cmd: "pnpm db:reset" },
        { name: "database lint", cmd: "pnpm db:lint" },
        { name: "database types up to date", cmd: "pnpm db:types:check" },
        { name: "database tests", cmd: "pnpm db:test" },
        { name: "build", cmd: "pnpm build" },
        {
          name: "no server secrets in the browser bundle",
          cmd: "node scripts/check-no-secrets-in-client.mjs",
        },
        { name: "e2e tests", cmd: "pnpm test:e2e" },
      ]),
];

const started = Date.now();
for (const step of steps) {
  const stepStarted = Date.now();
  console.log(`\n▶ ${step.name}`);
  const result = spawnSync(step.cmd, { stdio: "inherit", shell: true });
  const seconds = ((Date.now() - stepStarted) / 1000).toFixed(1);
  if (result.status !== 0) {
    console.error(`\n✖ validate failed at "${step.name}" (${seconds}s)`);
    if (step.hint) console.error(`  ${step.hint}`);
    process.exit(result.status ?? 1);
  }
  console.log(`✔ ${step.name} (${seconds}s)`);
}
console.log(
  `\n✔ validate passed in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
