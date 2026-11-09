// The single quality gate. CI runs it in full on every pull request; the pre-push hook runs --fast.
//   pnpm validate         full gate (needs local Supabase running: pnpm db:start)
//   pnpm validate --fast  static checks and unit tests only
// CI splits the same steps over parallel jobs (.github/workflows/ci.yml) with:
//   --no-static   leave out the --fast steps, which another job runs
//   --fresh-db    the stack was started from nothing in this job, which already applied every
//                 migration and the seed, so do not reset it
//   --shard=1/2   run that share of the e2e tests; the other jobs run the rest
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Cloud agents have no Docker, so they cannot run the full gate. CI runs it on their branch
// (docs/adr/0007); CLAUDE_CODE_REMOTE is set by Claude Code on the web.
const cloud = process.env.CLAUDE_CODE_REMOTE === "true";
const fast = process.argv.includes("--fast") || cloud;
const noStatic = process.argv.includes("--no-static");
const freshDb = process.argv.includes("--fresh-db");
const shard = process.argv
  .find((arg) => arg.startsWith("--shard="))
  ?.slice("--shard=".length);
if (shard && !/^[1-9]\d*\/[1-9]\d*$/.test(shard)) {
  console.error(`Bad --shard=${shard}. Use the form --shard=1/2.`);
  process.exit(2);
}
if (fast && noStatic) {
  console.error("--fast and --no-static together leave nothing to run.");
  process.exit(2);
}
if (cloud && !process.argv.includes("--fast")) {
  console.log("Cloud agent: running the fast checks. CI runs the full gate.");
}

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
  ...(noStatic
    ? []
    : [
        { name: "lint", cmd: "pnpm biome ci" },
        { name: "typecheck", cmd: "pnpm typecheck" },
        { name: "unit tests", cmd: "pnpm test" },
      ]),
  ...(fast
    ? []
    : [
        {
          name: "local Supabase is running",
          cmd: "pnpm exec supabase status",
          hint: "Start it with: pnpm db:start (Docker must be running)",
        },
        ...(freshDb
          ? []
          : [{ name: "migrations apply cleanly", cmd: "pnpm db:reset" }]),
        { name: "database lint", cmd: "pnpm db:lint" },
        { name: "database types up to date", cmd: "pnpm db:types:check" },
        { name: "database tests", cmd: "pnpm db:test" },
        { name: "build", cmd: "pnpm build" },
        {
          name: "no server secrets in the browser bundle",
          cmd: "node scripts/check-no-secrets-in-client.mjs",
        },
        {
          name: shard ? `e2e tests (shard ${shard})` : "e2e tests",
          cmd: `pnpm test:e2e:journeys${shard ? ` --shard=${shard}` : ""}`,
        },
        // Timed on its own, after the other tests, so nothing else is using the machine. One
        // shard is enough.
        ...(!shard || shard.startsWith("1/")
          ? [{ name: "performance tests", cmd: "pnpm test:e2e:performance" }]
          : []),
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
