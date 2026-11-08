// Sends every Feature Request's stage to the app (specs/124-feature-requests/, .github/workflows/board.yml).
//   node scripts/workflow/feature-requests-sync.mjs
//   DRY_RUN=1 node scripts/workflow/feature-requests-sync.mjs   print what would be sent
// Needs GH_TOKEN, and FEATURE_REQUESTS_SYNC_SECRET and PRODUCTION_URL to send; without them it warns
// and exits 0. The pure rules are in feature-requests.mjs.
import { existsSync, readFileSync } from "node:fs";
import { parseRefs } from "./board.mjs";
import {
  latestComment,
  newestPerRequest,
  readyNote,
  requestedBy,
  sendSync,
  stageFor,
} from "./feature-requests.mjs";
import { restAll } from "./github.mjs";

const names = (labels) => labels.map((label) => label.name);
const thirtyDaysAgo = new Date(
  Date.now() - 30 * 24 * 60 * 60 * 1000,
).toISOString();

// Open Features, and those closed recently enough that their last stage may not have reached the app.
// Only each request's newest is sent: a Round's follow-up Feature, else the request's own (spec 135).
const features = newestPerRequest(
  [
    ...restAll("issues?labels=feature&state=open&per_page=100"),
    ...restAll(
      `issues?labels=feature&state=closed&since=${thirtyDaysAgo}&per_page=100`,
    ),
  ].filter((issue) => !issue.pull_request && requestedBy(issue.body)),
);

const openPulls =
  features.length > 0 ? restAll("pulls?state=open&per_page=100") : [];

function specFolder(body) {
  const match = (body ?? "").match(
    /^### Spec folder[ \t]*\r?\n\s*(specs\/[\w.-]+)\/?/m,
  );
  return match?.[1] ?? null;
}

const requests = features.map((issue) => {
  const specIssue = restAll(
    `issues/${issue.number}/sub_issues?per_page=100`,
  ).find((child) => names(child.labels).includes("spec"));
  const slices = specIssue
    ? restAll(`issues/${specIssue.number}/sub_issues?per_page=100`)
    : [];

  const tracked = new Set([
    issue.number,
    specIssue?.number,
    ...slices.map((s) => s.number),
  ]);
  const openPullLabels = openPulls
    .filter((pull) =>
      parseRefs(pull.body).some((number) => tracked.has(number)),
    )
    .map((pull) => names(pull.labels));

  const comments = [
    ...restAll(`issues/${issue.number}/comments?per_page=100`),
    ...(specIssue
      ? restAll(`issues/${specIssue.number}/comments?per_page=100`)
      : []),
  ];

  const folder = specIssue ? specFolder(specIssue.body) : null;
  const specPath = folder ? `${folder}/spec.md` : null;

  return {
    featureIssue: issue.number,
    stage: stageFor({
      feature: {
        state: issue.state,
        stateReason: issue.state_reason ?? null,
        labels: names(issue.labels),
        assigned: issue.assignees.length > 0,
      },
      spec: specIssue
        ? {
            state: specIssue.state,
            stateReason: specIssue.state_reason ?? null,
            labels: names(specIssue.labels),
            subIssues: slices.map((child) => ({
              state: child.state,
              labels: names(child.labels),
            })),
          }
        : null,
      openPullLabels,
    }),
    specIssue: specIssue?.number ?? null,
    latestComment: latestComment(comments),
    readyNote:
      specPath && existsSync(specPath)
        ? readyNote(readFileSync(specPath, "utf8"))
        : null,
  };
});

for (const request of requests)
  console.log(`#${request.featureIssue}: ${request.stage}`);

if (process.env.DRY_RUN === "1") {
  console.log(JSON.stringify({ requests }, null, 2));
} else if (requests.length > 0) {
  const result = await sendSync({
    url: process.env.PRODUCTION_URL,
    secret: process.env.FEATURE_REQUESTS_SYNC_SECRET,
    requests,
  });
  console.log(`Feature Requests sync: ${result} (${requests.length})`);
}
