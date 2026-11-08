// The Feature Issue a Feature Request becomes. Its headings are the Feature issue template's
// (.github/ISSUE_TEMPLATE/1-feature.yml), which /deliver reads, so they must match it exactly.
// The repo is public and agents read every Issue, so the User's words are kept from shaping it:
// each field is quoted (no headings), and mentions and references are broken with a zero-width
// space (nobody is notified, no other Issue is linked).

export const ISSUE_LABELS = ["feature", "needs-triage", "priority:P2"];

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

export function issueTitle(goal: string): string {
  const line = (goal.trim().split(/\r?\n/)[0] ?? "").replace(/\s+/g, " ");
  const room = TITLE_MAX - TITLE_PREFIX.length;
  if (line.length <= room) return TITLE_PREFIX + neutralise(line);

  const cut = line.slice(0, room - 1);
  const atWord =
    cut.lastIndexOf(" ") > 0 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  return `${TITLE_PREFIX}${neutralise(atWord.trimEnd())}…`;
}

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
