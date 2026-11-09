// After a production deploy, close every Issue the deployed pull requests delivered, so the
// board's Done means "in production" (docs/adr/0007). Parent Issues close with their last
// sub-issue instead (board-sync.mjs).
//   node scripts/workflow/close-deployed.mjs <deployed sha>
// It checks the last 100 merged pull requests whose Issues are still open, not the commits since
// the previous deploy: a Deploy run's head_sha is main when it started, not what it deployed
// (#156). So an Issue a deploy missed closes with the next one.
import { deliveredBy, issuesToClose, productionComment } from "./board.mjs";
import { rest, restAll } from "./github.mjs";

const [sha] = process.argv.slice(2);
if (!sha) {
  console.error("Usage: close-deployed.mjs <sha>");
  process.exit(1);
}

const pulls = rest(
  "GET",
  "pulls?state=closed&base=main&sort=updated&direction=desc&per_page=100",
)
  .filter((pull) => pull.merged_at)
  .sort((a, b) => b.merged_at.localeCompare(a.merged_at));

// One call for every open Issue; an Issue missing from it is closed (or does not exist).
const openIssues = new Map(
  restAll("issues?state=open&per_page=100").map((issue) => [
    issue.number,
    issue,
  ]),
);

const issues = new Map();
function issueOf(number) {
  if (!issues.has(number)) {
    const issue = openIssues.get(number);
    issues.set(
      number,
      issue
        ? {
            labels: issue.labels.map((label) => label.name),
            subIssues: issue.sub_issues_summary?.total ?? 0,
            isPullRequest: Boolean(issue.pull_request),
            deliveredBy: issue.comments
              ? deliveredBy(restAll(`issues/${number}/comments?per_page=100`))
              : [],
          }
        : null,
    );
  }
  return issues.get(number);
}

// "identical" or "ahead": the deployed commit contains the pull request's merge commit.
function isDeployed(pull) {
  try {
    const { status } = rest("GET", `compare/${pull.merge_commit_sha}...${sha}`);
    return status === "identical" || status === "ahead";
  } catch {
    return false;
  }
}

for (const { issue, pull } of issuesToClose(pulls, issueOf, isDeployed)) {
  rest("POST", `issues/${issue}/comments`, {
    body: productionComment(sha, pull),
  });
  rest("PATCH", `issues/${issue}`, {
    state: "closed",
    state_reason: "completed",
  });
  console.log(`Closed #${issue} (delivered by #${pull})`);
}
