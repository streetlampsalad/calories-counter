// The merge gate (.github/workflows/merge-gate.yml, docs/adr/0007). Runs from main's code on
// pull_request_target, so a pull request cannot change the rules that judge it.
//   1. Adds `needs-human-review` when the deterministic rules in gates.mjs match.
//   2. Puts the label back if anyone but the repo owner removes it.
//   3. Fails (a required check) while the label is on; otherwise enables auto-merge.
// Needs GH_TOKEN (AUTOMATION_TOKEN, so the squash merge triggers CI and deploy on main).
import { execFileSync } from "node:child_process";
import { humanReviewReasons } from "./gates.mjs";
import { readEvent, rest, restAll } from "./github.mjs";

const LABEL = "needs-human-review";
const MARKER = "<!-- merge-gate -->";

const { payload } = readEvent();
const pull = payload.pull_request;
const number = pull.number;
const repoOwner = payload.repository.owner.login;
const labels = () =>
  rest("GET", `issues/${number}/labels`).map((label) => label.name);

function addLabel(reason) {
  rest("POST", `issues/${number}/labels`, { labels: [LABEL] });
  rest("POST", `issues/${number}/comments`, { body: `${MARKER}\n${reason}` });
}

if (payload.action === "unlabeled" && payload.label?.name === LABEL) {
  if (payload.sender.login !== repoOwner) {
    addLabel(
      `Only @${repoOwner} can remove \`${LABEL}\`. Agents may add it, never remove it.`,
    );
  } else {
    console.log(`Human review given by ${payload.sender.login}.`);
  }
} else if (
  ["opened", "reopened", "synchronize", "edited", "ready_for_review"].includes(
    payload.action,
  )
) {
  const files = restAll(`pulls/${number}/files?per_page=100`);
  const reasons = humanReviewReasons(files, pull.body ?? "");
  if (reasons.length > 0 && !labels().includes(LABEL)) {
    addLabel(
      [
        `This pull request needs Human review before it merges (commit ${pull.head.sha.slice(0, 7)}):`,
        "",
        ...reasons.map((reason) => `- ${reason}`),
        "",
        `@${repoOwner}: review it, then remove \`${LABEL}\` to let it auto-merge.`,
      ].join("\n"),
    );
  }
}

const flagged = labels().includes(LABEL);
const gh = (...args) =>
  execFileSync("gh", ["pr", ...args, String(number)], { stdio: "inherit" });

if (flagged) {
  try {
    gh("merge", "--disable-auto");
  } catch {
    // Auto-merge was not enabled.
  }
  console.error(
    `::error::Waiting for Human review: remove "${LABEL}" once a human has approved this pull request.`,
  );
  process.exit(1);
}

if (pull.draft) {
  console.log("Draft: auto-merge waits until it is ready for review.");
} else {
  gh("merge", "--auto", "--squash");
  console.log(
    "Auto-merge enabled. It merges once CI and the Claude review pass.",
  );
}
