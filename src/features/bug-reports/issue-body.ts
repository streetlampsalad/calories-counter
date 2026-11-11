import { cutTitle, neutralise, quote } from "@/lib/issue-text";
import { APP_VERSION_LABEL, DEVICE_LINES, type Device } from "./device";
import { type BugReportInput, SCREEN_LABELS, SEVERITY_OPTIONS } from "./domain";

// The Bug Issue a Bug report becomes (spec 194). Its headings are the Bug issue template's
// (.github/ISSUE_TEMPLATE/3-bug.yml), which /deliver's bug.md reads, so they must match it exactly
// and in order. Every User-written field is quoted, as spec 124's Feature Issues are.

export const BUG_LABELS = ["bug", "needs-triage"];

// The template's Risk assessment options, all unticked: the agent that takes the Bug fills it in.
const RISK_OPTIONS = [
  "Adds a third-party integration, secret, environment variable or dashboard step",
  "Irreversible (drops or renames a column or table, or rewrites or deletes User data)",
  "Cannot be proved in CI (real device, real external API)",
  "Touches sign-in, RLS policies or what one User can see of another",
  "Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow)",
  "Contradicts an ADR or needs a new one",
];

export type IssueToggle = {
  key: string;
  title: string;
  state: "testing" | "live";
};

export const bugIssueTitle = (whatWentWrong: string) =>
  cutTitle("Bug: ", whatWentWrong);

function togglesSection(toggles: readonly IssueToggle[] | null): string {
  if (!toggles) return "Couldn't be read";
  if (toggles.length === 0) return "No Toggles on";
  const testingFirst = [
    ...toggles.filter((toggle) => toggle.state === "testing"),
    ...toggles.filter((toggle) => toggle.state !== "testing"),
  ];
  return testingFirst
    .map(
      (toggle) =>
        `- ${neutralise(toggle.title)} (\`${toggle.key}\`): ${
          toggle.state === "testing" ? "Testing" : "Live"
        }`,
    )
    .join("\n");
}

// A device value quoted as code on one line (FR-008): without backticks, so it can't close the
// code, and without line breaks, control or invisible characters, so it can't add a line.
const deviceValue = (text: string) =>
  neutralise(text.replace(/[`\p{Cc}\p{Cf}\u2028\u2029]/gu, "").trim());

function deviceSection(version: string, device: Partial<Device>): string {
  return [
    `- ${APP_VERSION_LABEL}: ${neutralise(version)}`,
    ...DEVICE_LINES.flatMap(({ key, label }) => {
      const value = device[key] && deviceValue(device[key]);
      return value ? [`- ${label}: \`${value}\``] : [];
    }),
  ].join("\n");
}

export function bugIssueBody(bug: {
  id: string;
  report: BugReportInput;
  // null when the Toggles could not be read.
  toggles: readonly IssueToggle[] | null;
  version: string;
  // Parsed by parseDevice; missing when the browser sent none.
  device?: Partial<Device>;
}): string {
  const { report } = bug;
  return [
    "### Steps to reproduce",
    "",
    `Where in the app: ${report.screen ? SCREEN_LABELS[report.screen] : "Not given"}`,
    "",
    quote(report.howItHappened),
    "",
    "### Expected",
    "",
    quote(report.expected),
    "",
    "### Actual",
    "",
    quote(report.whatWentWrong),
    "",
    "### Device",
    "",
    deviceSection(bug.version, bug.device ?? {}),
    "",
    "### Toggles",
    "",
    togglesSection(bug.toggles),
    "",
    "### How bad is it",
    "",
    SEVERITY_OPTIONS[report.severity].issueText,
    "",
    "### Requested by",
    "",
    bug.id,
    "",
    "### Risk assessment",
    "",
    ...RISK_OPTIONS.map((option) => `- [ ] ${option}`),
    "",
  ].join("\n");
}
