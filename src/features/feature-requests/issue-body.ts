import { cutTitle, quote } from "@/lib/issue-text";
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

export const issueTitle = (goal: string) => cutTitle(TITLE_PREFIX, goal);

export const followUpTitle = (goal: string) =>
  cutTitle(`${TITLE_PREFIX}Feedback on `, goal);

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
// carries no User-written text, because agents act on it. It is created without ready-for-agent,
// which is added only once the Toggle has left Testing, so no agent ever deletes the checks of a
// feature still being tried.
export const CHORE_LABELS = ["chore", "priority:P2"];
export const CHORE_READY_LABELS = ["ready-for-agent"];

const CHORE_RISKS = [
  "Adds a third-party integration, secret, environment variable or dashboard step",
  "Irreversible (drops or renames a column or table, or rewrites or deletes User data)",
  "Cannot be proved in CI (real device, real external API)",
  "Touches sign-in, RLS policies or what one User can see of another",
  "Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow)",
  "Adds or upgrades a dependency",
];

const IRREVERSIBLE = CHORE_RISKS[1];

// It's ready deletes the Toggle's checks; Remove it deletes the feature itself, and its tables in a
// migration, which is irreversible, so the merge gate flags that Chore's pull request for the Owner.
function choreText(decision: Decision, featureIssue: number) {
  const key = `feature-${featureIssue}`;
  if (decision === "ready")
    return {
      title: `Chore: Remove the Toggle for #${featureIssue}`,
      what: `Feature #${featureIssue} is Live for everyone: its Requester marked it ready. Delete every \`useToggle("${key}")\`, \`isToggleOn("${key}")\` and \`toggle_is_on('${key}')\` check and the tests of the "off" path; keep the "on" path, and drop the Toggle setup from its tests. Keep the Toggle's row in \`public.toggles\`: a Feature Request's card reads it to say Live for everyone (spec 135 D11).`,
      why: `The Toggle \`${key}\` is Live, so its checks are dead code (ADR 0008).`,
      risks: [] as string[],
    };
  return {
    title: `Chore: Remove the feature for #${featureIssue}`,
    what: `Feature #${featureIssue} is Removed: its Requester decided not to keep it. Delete the code behind \`${key}\`, including what its follow-up Features (\`### Follow-up to #${featureIssue}\`) added: every component, route, server action, query and test that only it uses, and every \`useToggle("${key}")\`, \`isToggleOn("${key}")\` and \`toggle_is_on('${key}')\` check, keeping the "off" path. Then, in a new migration, drop every table, column, function, trigger, policy, type and scheduled job only it used. Migrations ship before the app (ADR 0003), so drop only what the deployed app no longer reads; anything it still reads waits for a follow-up Chore. Keep the Toggle's row in \`public.toggles\`: a Feature Request's card reads it to say Removed (spec 135 D11).`,
    why: `The Toggle \`${key}\` is Removed, so the feature is off for everyone and its code is dead (ADR 0008).`,
    risks: [IRREVERSIBLE],
  };
}

export function cleanupChore(
  decision: Decision,
  featureIssue: number,
): { title: string; body: string; labels: string[] } {
  const text = choreText(decision, featureIssue);
  return {
    title: text.title,
    body: [
      "### What",
      "",
      text.what,
      "",
      "### Why",
      "",
      text.why,
      "",
      "### Behaviour",
      "",
      "- [x] No User-visible behaviour changes. If it does, this is a Feature or a Bug instead.",
      "",
      "### Risk assessment",
      "",
      ...CHORE_RISKS.map(
        (risk) => `- [${text.risks.includes(risk) ? "x" : " "}] ${risk}`,
      ),
      "",
    ].join("\n"),
    labels: CHORE_LABELS,
  };
}
