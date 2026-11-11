// Sends every in-app Bug report's outcome to the app (specs/194-bug-reports/, .github/workflows/board.yml).
//   node scripts/workflow/bug-reports-sync.mjs
//   DRY_RUN=1 node scripts/workflow/bug-reports-sync.mjs   print what would be sent
// Needs GH_TOKEN, and FEATURE_REQUESTS_SYNC_SECRET and PRODUCTION_URL to send; without them it warns
// and exits 0. The pure rules are in bug-reports.mjs.
import { bugReportUpdates, sendBugReportSync } from "./bug-reports.mjs";
import { rest } from "./github.mjs";

// Every page of a list, one request at a time: GitHub's Link header does not work through the cloud
// proxy (.claude/skills/deliver/github.md), so this never relies on it.
function pages(path) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const items = rest(
      "GET",
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    all.push(...items);
    if (items.length < 100) return all;
  }
}

const thirtyDaysAgo = new Date(
  Date.now() - 30 * 24 * 60 * 60 * 1000,
).toISOString();

// Open Bugs, and those closed recently enough that their last outcome may not have reached the app.
const issues = [
  ...pages("issues?labels=bug&state=open"),
  ...pages(`issues?labels=bug&state=closed&since=${thirtyDaysAgo}`),
];
const pulls = pages("pulls?state=open");

const updates = bugReportUpdates({
  issues,
  pulls,
  commentsFor: (number) => pages(`issues/${number}/comments`),
});

for (const update of updates)
  console.log(`#${update.bug_issue}: ${update.outcome}`);

if (process.env.DRY_RUN === "1") {
  console.log(JSON.stringify({ updates }, null, 2));
} else if (updates.length > 0) {
  const result = await sendBugReportSync({
    url: process.env.PRODUCTION_URL,
    secret: process.env.FEATURE_REQUESTS_SYNC_SECRET,
    updates,
  });
  console.log(`Bug reports sync: ${result} (${updates.length})`);
}
