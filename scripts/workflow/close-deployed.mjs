// After a production deploy, close every Issue the deployed pull requests delivered, so the
// board's Done means "in production" (docs/adr/0007). Parent Issues close with their last
// sub-issue instead (board-sync.mjs).
//   node scripts/workflow/close-deployed.mjs <deployed sha> [<previously deployed sha>]
// Deploys queue and can skip commits, so it walks every commit since the previous deploy.
import { parseRefs } from "./board.mjs";
import { rest } from "./github.mjs";

const [sha, previous] = process.argv.slice(2);
if (!sha) {
  console.error("Usage: close-deployed.mjs <sha> [<previous sha>]");
  process.exit(1);
}

const commits = previous
  ? rest("GET", `compare/${previous}...${sha}`).commits.map(
      (commit) => commit.sha,
    )
  : [sha];

const pulls = new Map();
for (const commit of commits) {
  for (const pull of rest("GET", `commits/${commit}/pulls`)) {
    if (pull.merged_at) pulls.set(pull.number, pull);
  }
}

for (const pull of pulls.values()) {
  for (const number of parseRefs(pull.body)) {
    const issue = rest("GET", `issues/${number}`);
    if (issue.pull_request || issue.state !== "open") continue;
    // Parents (a Spec, or a Feature with its Spec) close with their last sub-issue.
    if (issue.labels.some((label) => label.name === "spec")) continue;
    if ((issue.sub_issues_summary?.total ?? 0) > 0) continue;
    rest("POST", `issues/${number}/comments`, {
      body: `In production since ${sha.slice(0, 7)} (#${pull.number}).`,
    });
    rest("PATCH", `issues/${number}`, {
      state: "closed",
      state_reason: "completed",
    });
    console.log(`Closed #${number} (delivered by #${pull.number})`);
  }
}
