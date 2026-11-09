// Writes `wake=true` or `wake=false` to the job's outputs for .github/workflows/dispatcher.yml.
//   node scripts/workflow/dispatcher-wake.mjs
import { appendFileSync } from "node:fs";
import { wakesDispatcher } from "./dispatcher.mjs";
import { readEvent } from "./github.mjs";

const { payload } = readEvent();
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? "streetlampsalad";
const wake = wakesDispatcher(payload, owner);
console.log(
  `issues.${payload.action} on #${payload.issue?.number}: ${wake ? "wake" : "no new work"}`,
);
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `wake=${wake}\n`);
