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
