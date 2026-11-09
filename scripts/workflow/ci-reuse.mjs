// Writes `reuse=true` when this push to main is the tree its merged pull request's CI already
// tested and passed, so ci.yml can skip `pnpm validate` (#161). Anything unexpected means
// `reuse=false`, and CI runs in full.
//   SHA=<pushed commit> TREE=<its tree> node scripts/workflow/ci-reuse.mjs
import { appendFileSync } from "node:fs";
import { reusablePullRequestRun, testedTreeName } from "./ci.mjs";
import { repo, rest } from "./github.mjs";

const { SHA: sha, TREE: tree } = process.env;

function decide() {
  const pull = rest("GET", `commits/${sha}/pulls`).find(
    (candidate) => candidate.merge_commit_sha === sha,
  );
  if (!pull) return "no merged pull request for this commit";
  const { workflow_runs: runs } = rest(
    "GET",
    `actions/workflows/ci.yml/runs?event=pull_request&head_sha=${pull.head.sha}&per_page=20`,
  );
  const runId = reusablePullRequestRun(pull, runs, repo);
  if (!runId) return `#${pull.number}'s newest CI run did not pass here`;
  const names = rest("GET", `actions/runs/${runId}/artifacts`).artifacts.map(
    (artifact) => artifact.name,
  );
  if (!names.includes(testedTreeName(tree)))
    return `#${pull.number}'s CI recorded no test of this tree (main moved after it ran)`;
  return null;
}

let reason;
try {
  reason = decide();
} catch (error) {
  reason = `could not check: ${error.message}`;
}
console.log(
  reason
    ? `Running pnpm validate: ${reason}.`
    : "Reusing the pull request's CI: it tested this exact tree.",
);
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `reuse=${!reason}\n`);
