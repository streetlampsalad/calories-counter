import type { Decision } from "./domain";

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

// The clean-up Chore an agent delivers once a Requester has decided (spec 135 D4, ADR 0008). It
// carries no User-written text: it is labelled ready-for-agent, so nothing a User typed reaches it.
export const CHORE_LABELS = ["chore", "ready-for-agent", "priority:P2"];

const CHORE_RISKS = [
  "Adds a third-party integration, secret, environment variable or dashboard step",
  "Irreversible (drops or renames a column or table, or rewrites or deletes User data)",
  "Cannot be proved in CI (real device, real external API)",
  "Touches sign-in, RLS policies or what one User can see of another",
  "Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow)",
  "Adds or upgrades a dependency",
];

export function cleanupChore(
  decision: Decision,
  featureIssue: number,
): { title: string; body: string; labels: string[] } {
  const key = `feature-${featureIssue}`;
  return {
    title: `Chore: Remove the Toggle for #${featureIssue}`,
    body: [
      "### What",
      "",
      `Feature #${featureIssue} is Live for everyone: its Requester marked it ready. Delete every \`useToggle("${key}")\` and \`isToggleOn("${key}")\` check, keeping the "on" path, and the tests of the "off" path. Keep the Toggle's row in \`public.toggles\`: a Feature Request's card reads it to say Live for everyone (spec 135 D11).`,
      "",
      "### Why",
      "",
      `The Toggle \`${key}\` is Live, so its checks are dead code (ADR 0008).`,
      "",
      "### Behaviour",
      "",
      "- [x] No User-visible behaviour changes. If it does, this is a Feature or a Bug instead.",
      "",
      "### Risk assessment",
      "",
      ...CHORE_RISKS.map((risk) => `- [ ] ${risk}`),
      "",
    ].join("\n"),
    labels: CHORE_LABELS,
  };
}
