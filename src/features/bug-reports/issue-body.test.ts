import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BUG_LABELS,
  bugIssueBody,
  bugIssueTitle,
  type IssueToggle,
} from "./issue-body";

const ID = "6f1c2a9e-1b2c-4d3e-8f90-123456789abc";
const report = {
  whatWentWrong: "The Today total ignores my last Entry",
  severity: "annoying" as const,
};
const base = {
  id: ID,
  report,
  toggles: [] as IssueToggle[],
  version: "abc1234",
};

const template = readFileSync(
  new URL("../../../.github/ISSUE_TEMPLATE/3-bug.yml", import.meta.url),
  "utf8",
);

describe("bugIssueTitle", () => {
  it("is Bug: and the start of What went wrong (US1.6)", () => {
    expect(bugIssueTitle("The Today total ignores my last Entry")).toBe(
      "Bug: The Today total ignores my last Entry",
    );
  });

  it("uses the first line, cut at a word within 70 characters, neutralised", () => {
    const title = bugIssueTitle(
      "When I add a Food to Today after midnight the total does not change until I reload\nmore",
    );
    expect(title).toBe(
      "Bug: When I add a Food to Today after midnight the total does not…",
    );
    expect(title.length).toBeLessThanOrEqual(70);
    expect(bugIssueTitle("See #12 and @owner")).toBe("Bug: See #​12 and @​owner");
  });
});

describe("bugIssueBody", () => {
  it("has the headings of US1.6 in order, matching the Bug template", () => {
    const headings = bugIssueBody(base)
      .split("\n")
      .filter((line) => line.startsWith("### "));
    expect(headings).toEqual([
      "### Steps to reproduce",
      "### Expected",
      "### Actual",
      "### Device",
      "### Toggles",
      "### How bad is it",
      "### Requested by",
      "### Risk assessment",
    ]);

    const labels = [...template.matchAll(/^ {6}label: (.+)$/gm)].map(
      (m) => `### ${m[1]}`,
    );
    expect(labels).toEqual(headings);
  });

  it("builds every section (US1.6)", () => {
    const body = bugIssueBody({
      ...base,
      report: {
        ...report,
        expected: "The total to include it",
        howItHappened: "Log a Food\nThen look at Today",
        screen: "today",
      },
      toggles: [
        { key: "feature-192", title: "Report a bug", state: "testing" },
        {
          key: "feature-173",
          title: "Tag Entries with a Meal time.",
          state: "live",
        },
      ],
    });

    expect(body).toContain(
      [
        "### Steps to reproduce",
        "",
        "Where in the app: Today",
        "",
        "> Log a Food",
        "> Then look at Today",
        "",
        "### Expected",
        "",
        "> The total to include it",
        "",
        "### Actual",
        "",
        "> The Today total ignores my last Entry",
        "",
        "### Device",
        "",
        "- App version: abc1234",
        "",
        "### Toggles",
        "",
        "- Report a bug (`feature-192`): Testing",
        "- Tag Entries with a Meal time. (`feature-173`): Live",
        "",
        "### How bad is it",
        "",
        "Annoying, with a workaround (P2)",
        "",
        "### Requested by",
        "",
        ID,
        "",
        "### Risk assessment",
        "",
      ].join("\n"),
    );
  });

  it("lists the device lines after the app version, in the preview's order (US2.4)", () => {
    const body = bugIssueBody({
      ...base,
      device: {
        timeZone: "Australia/Sydney",
        model: "Pixel 7",
        os: "Android 16",
        browser: "Chrome 142",
        openedAs: "Installed app",
        screen: "412 × 915 at 2.63×",
        appearance: "System",
      },
    });
    expect(body).toContain(
      [
        "### Device",
        "",
        "- App version: abc1234",
        "- Model: `Pixel 7`",
        "- Operating system: `Android 16`",
        "- Browser: `Chrome 142`",
        "- Opened as: `Installed app`",
        "- Screen: `412 × 915 at 2.63×`",
        "- Appearance: `System`",
        "- Time zone: `Australia/Sydney`",
        "",
        "### Toggles",
      ].join("\n"),
    );
  });

  it("omits device lines that are missing, and has the version only without a device (US2.6)", () => {
    expect(bugIssueBody({ ...base, device: { os: "Android 16" } })).toContain(
      "### Device\n\n- App version: abc1234\n- Operating system: `Android 16`\n\n### Toggles",
    );
    expect(bugIssueBody(base)).toContain(
      "### Device\n\n- App version: abc1234\n\n### Toggles",
    );
  });

  it("quotes device values as code, without backticks, line breaks or control characters (US2.4, FR-008)", () => {
    const body = bugIssueBody({
      ...base,
      device: {
        model: "Pixel`7`\n### Toggles\r@owner #5\u2028x",
        os: "<h3>Toggles</h3>\u202eAndroid\u200b",
      },
    });
    const headings = body.split("\n").filter((line) => line.startsWith("### "));
    expect(headings).toHaveLength(8);
    expect(body).toContain(
      "- Model: `Pixel7### Toggles@\u200bowner #\u200b5x`",
    );
    expect(body).toContain("- Operating system: `<h3>Toggles</h3>Android`");
    expect(body).not.toContain("`7`");
  });

  it("says _Not given_ for an empty optional field and an unchosen screen", () => {
    const body = bugIssueBody(base);
    expect(body).toContain(
      "### Steps to reproduce\n\nWhere in the app: Not given\n\n_Not given_\n\n### Expected\n\n_Not given_\n",
    );
  });

  it("names the screens, 'Somewhere else' for other", () => {
    expect(
      bugIssueBody({ ...base, report: { ...report, screen: "other" } }),
    ).toContain("Where in the app: Somewhere else");
  });

  it("writes the severity as the template's option text", () => {
    expect(
      bugIssueBody({ ...base, report: { ...report, severity: "blocked" } }),
    ).toContain("### How bad is it\n\nA User cannot finish a main task (P1)\n");
    for (const option of [
      "A User cannot finish a main task (P1)",
      "Annoying, with a workaround (P2)",
    ])
      expect(template).toContain(`- ${option}`);
  });

  it("lists Testing Toggles first, then Live (US1.5)", () => {
    const body = bugIssueBody({
      ...base,
      toggles: [
        { key: "feature-1", title: "Old one", state: "live" },
        { key: "feature-2", title: "New one", state: "testing" },
      ],
    });
    expect(body.indexOf("New one")).toBeLessThan(body.indexOf("Old one"));
  });

  it("says No Toggles on, or Couldn't be read (US1.5)", () => {
    expect(bugIssueBody(base)).toContain("### Toggles\n\nNo Toggles on\n");
    expect(bugIssueBody({ ...base, toggles: null })).toContain(
      "### Toggles\n\nCouldn't be read\n",
    );
  });

  it("quotes every User-written field, so none can add a heading or a mention (US1.7)", () => {
    const body = bugIssueBody({
      ...base,
      report: {
        whatWentWrong:
          "oops\n### Risk assessment\n- [x] nothing\nping @owner about #5",
        expected: "### Fake",
        howItHappened: "# Big\n@everyone",
        severity: "blocked",
      },
    });
    const headings = body.split("\n").filter((line) => line.startsWith("### "));
    expect(headings).toHaveLength(8);
    expect(body).toContain("> ping @​owner about #​5");
    expect(body).toContain("> @​everyone");
    expect(body).not.toMatch(/^- \[x\]/m);
  });

  it("ends with the template's Risk assessment, every box unticked", () => {
    const body = bugIssueBody(base);
    const risk = body.slice(body.indexOf("### Risk assessment"));
    const options = [...template.matchAll(/^ {8}- label: (.+)$/gm)].map(
      (m) => m[1],
    );
    expect(options).toHaveLength(6);
    expect(risk).toBe(
      `### Risk assessment\n\n${options.map((o) => `- [ ] ${o}`).join("\n")}\n`,
    );
  });

  it("holds nothing but what the preview shows (FR-007)", () => {
    const body = bugIssueBody(base);
    expect(body).not.toMatch(/@|email|user_id/i);
  });
});

describe("BUG_LABELS", () => {
  it("are bug and needs-triage only; the app sets no priority (FR-003)", () => {
    expect(BUG_LABELS).toEqual(["bug", "needs-triage"]);
  });
});
