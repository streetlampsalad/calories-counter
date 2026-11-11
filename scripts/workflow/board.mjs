// Pure rules for the Kanban board (docs/agents/workflow.md). The board is a projection:
// an Issue's Status is computed from its state, labels, assignees and pull requests, so
// re-running the sync always lands on the same answer.

export const STATUS = {
  backlog: "Backlog",
  ready: "Ready",
  inProgress: "In progress",
  inReview: "In review",
  done: "Done",
};

const REF =
  /\b(?:refs?|fix(?:e[sd])?|close[sd]?|resolve[sd]?)\b:?\s+((?:#\d+(?:\s*,\s*|\s+and\s+|\s+)?)+)/gi;

/** Issue numbers a pull request body points at with "Refs #n" (or a closing keyword). */
export function parseRefs(body) {
  const numbers = new Set();
  for (const match of (body ?? "").matchAll(REF)) {
    for (const number of match[1].matchAll(/#(\d+)/g))
      numbers.add(Number(number[1]));
  }
  return [...numbers].sort((a, b) => a - b);
}

/**
 * Issue numbers a pull request points at in its title or its body, each once. A pull request
 * opened from GitHub's page may carry "Refs #n" only in its title (#197).
 */
export function pullRefs({ title, body }) {
  return [...new Set([...parseRefs(title), ...parseRefs(body)])].sort(
    (a, b) => a - b,
  );
}

/**
 * @typedef {{ state: "OPEN" | "CLOSED", merged: boolean, isDraft: boolean }} LinkedPull
 * @typedef {{
 *   state: "OPEN" | "CLOSED",
 *   labels: string[],
 *   assigned: boolean,
 *   pulls: LinkedPull[],
 *   subIssues?: { state: "OPEN" | "CLOSED", assigned: boolean }[],
 * }} IssueFacts
 */

/** @param {IssueFacts} issue */
export function statusFor(issue) {
  if (issue.state === "CLOSED") return STATUS.done;

  const openPulls = issue.pulls.filter((pull) => pull.state === "OPEN");
  if (openPulls.some((pull) => !pull.isDraft)) return STATUS.inReview;

  const merged = issue.pulls.some((pull) => pull.merged);
  if (isParent(issue)) {
    // A Spec (or a Feature holding its Spec) closes with its last sub-issue. A merged Spec
    // pull request means its Slices are next.
    const started = (issue.subIssues ?? []).some(
      (child) => child.state === "CLOSED" || child.assigned,
    );
    if (merged || started || openPulls.length > 0 || issue.assigned)
      return STATUS.inProgress;
  } else {
    // Merged but not yet in production: deploy.yml closes it once production serves it.
    if (merged) return STATUS.inReview;
    if (openPulls.length > 0 || issue.assigned) return STATUS.inProgress;
  }

  if (issue.labels.includes("ready-for-agent")) return STATUS.ready;
  return STATUS.backlog;
}

/** Board fields mirrored from labels, because cloud agents can only set labels. */
export function fieldsFromLabels(labels) {
  const fields = {};
  for (const label of labels) {
    const priority = label.match(/^priority:(P\d)$/);
    if (priority) fields.Priority = priority[1];
    const size = label.match(/^size:(XS|S|M|L|XL)$/);
    if (size) fields.Size = size[1];
  }
  return fields;
}

/** A Spec, or a Feature once it has a Spec, is tracked through its sub-issues. */
export function isParent(issue) {
  return issue.labels.includes("spec") || (issue.subIssues ?? []).length > 0;
}

/** A parent closes once it has sub-issues and every one of them is closed. */
export function parentIsFinished(subIssues) {
  return (
    subIssues.length > 0 && subIssues.every((child) => child.state === "CLOSED")
  );
}

/** The comment close-deployed.mjs leaves, naming the pull request that delivered the Issue. */
export function productionComment(sha, pull) {
  return `In production as of ${sha.slice(0, 7)} (#${pull}).`;
}

/** The pull requests a deploy already closed this Issue for, from its comments. */
export function deliveredBy(comments) {
  return comments.flatMap((comment) => {
    const match = comment.body.match(
      /^In production (?:since|as of) [0-9a-f]{7} \(#(\d+)\)\.$/,
    );
    return match ? [Number(match[1])] : [];
  });
}

/**
 * The Issues a production deploy delivered: each open Issue whose newest merged pull request is
 * in the deployed commit. `pulls` are merged pull requests, newest first; `issueOf` gives an open
 * Issue, or null for one that is closed or missing. Specs and other parents close with their last
 * sub-issue instead (board-sync.mjs). An Issue reopened after a pull request delivered it waits
 * for a newer one, and `isDeployed`, a GitHub call, is asked only about pull requests that could
 * close something.
 */
export function issuesToClose(pulls, issueOf, isDeployed) {
  const newest = new Map();
  for (const pull of pulls) {
    for (const number of pullRefs(pull))
      if (!newest.has(number)) newest.set(number, pull);
  }

  const closing = [];
  for (const pull of pulls) {
    const open = pullRefs(pull).filter((number) => {
      if (newest.get(number) !== pull) return false;
      const issue = issueOf(number);
      return (
        issue !== null &&
        !issue.isPullRequest &&
        !issue.labels.includes("spec") &&
        issue.subIssues === 0 &&
        !issue.deliveredBy.includes(pull.number)
      );
    });
    if (open.length === 0 || !isDeployed(pull)) continue;
    for (const number of open)
      closing.push({ issue: number, pull: pull.number });
  }
  return closing;
}
