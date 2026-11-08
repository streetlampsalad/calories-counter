// The Feature Issue a Feature Request becomes. Its headings are the Feature issue template's
// (.github/ISSUE_TEMPLATE/1-feature.yml), which /deliver reads, so they must match it exactly.
// The repo is public and agents read every Issue, so the User's words are kept from shaping it:
// each field is quoted (no headings), and mentions and references are broken with a zero-width
// space (nobody is notified, no other Issue is linked).

export const ISSUE_LABELS = ["feature", "needs-triage", "priority:P2"];
// Feedback on a feature already being tried goes ahead of new requests (spec 135 US1.3).
export const FOLLOW_UP_LABELS = ["feature", "needs-triage", "priority:P1"];

const TITLE_PREFIX = "Feature: ";
const TITLE_MAX = 70;
const ZERO_WIDTH_SPACE = "​";
const NOT_GIVEN = "_Not given_";

function neutralise(text: string): string {
  return text
    .replace(/@(?=[\w-])/g, `@${ZERO_WIDTH_SPACE}`)
    .replace(/#(?=\d)/g, `#${ZERO_WIDTH_SPACE}`);
}

function quote(text: string | undefined): string {
  const trimmed = text?.trim();
  if (!trimmed) return NOT_GIVEN;
  return neutralise(trimmed)
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `> ${line}` : ">"))
    .join("\n");
}

function title(prefix: string, goal: string): string {
  const line = (goal.trim().split(/\r?\n/)[0] ?? "").replace(/\s+/g, " ");
  const room = TITLE_MAX - prefix.length;
  if (line.length <= room) return prefix + neutralise(line);

  const cut = line.slice(0, room - 1);
  const atWord =
    cut.lastIndexOf(" ") > 0 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  return `${prefix}${neutralise(atWord.trimEnd())}…`;
}

export const issueTitle = (goal: string) => title(TITLE_PREFIX, goal);

export const followUpTitle = (goal: string) =>
  title(`${TITLE_PREFIX}Feedback on `, goal);

export function issueBody(request: {
  id: string;
  goal: string;
  problem?: string;
  details?: string;
}): string {
  return [
    "### Problem",
    "",
    quote(request.problem),
    "",
    "### Who has it",
    "",
    "The requester.",
    "",
    "### Desired outcome",
    "",
    quote(request.goal),
    "",
    "### Additional details",
    "",
    quote(request.details),
    "",
    "### Requested by",
    "",
    request.id,
    "",
  ].join("\n");
}

// A Round (spec 135 US1.3): the Requester's feedback is the Problem, the original goal still the
// outcome, and `### Follow-up to` tells triage to change the feature behind its existing Toggle.
// `### Requested by` is the request's own id, so the sync finds the request from either Issue.
export function followUpBody(round: {
  id: string;
  goal: string;
  feedback: string;
  featureIssue: number;
  round: number;
}): string {
  return [
    "### Problem",
    "",
    quote(round.feedback),
    "",
    "### Who has it",
    "",
    "The requester.",
    "",
    "### Desired outcome",
    "",
    quote(round.goal),
    "",
    "### Additional details",
    "",
    `Round ${round.round} of #${round.featureIssue}.`,
    "",
    "### Follow-up to",
    "",
    `#${round.featureIssue}`,
    "",
    "### Requested by",
    "",
    round.id,
    "",
  ].join("\n");
}
