import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bug reports sent from the app write Issues with these headings (spec 194 FR-003, FR-009), so the
// Bug template and the Bug triage must know every one of them.
const template = readFileSync(".github/ISSUE_TEMPLATE/3-bug.yml", "utf8");
const bug = readFileSync(".claude/skills/deliver/bug.md", "utf8");

const at = (label) => template.indexOf(`label: ${label}`);

describe("the Bug template", () => {
  it("has a Toggles field after Device and before Risk assessment", () => {
    expect(at("Toggles")).toBeGreaterThan(at("Device"));
    expect(at("Toggles")).toBeLessThan(at("Risk assessment"));
  });

  it("has a Requested by field after How bad is it and before Risk assessment", () => {
    expect(at("Requested by")).toBeGreaterThan(at("How bad is it"));
    expect(at("Requested by")).toBeLessThan(at("Risk assessment"));
  });

  it("makes Device a textarea that mentions the app version", () => {
    const device = template.slice(
      template.indexOf("id: device") - 30,
      at("Toggles"),
    );
    expect(device).toContain("type: textarea");
    expect(device).toContain("app version");
  });

  it("keeps the new fields optional, so a Bug filed on GitHub needs neither", () => {
    const optional = template.slice(at("Toggles"), at("How bad is it"));
    expect(optional).not.toContain("required: true");
    const requestedBy = template.slice(
      at("Requested by"),
      at("Risk assessment"),
    );
    expect(requestedBy).not.toContain("required: true");
  });
});

describe("bug.md", () => {
  it("reads every heading, including Toggles and Requested by (US1.12)", () => {
    for (const heading of [
      "Steps to reproduce",
      "Expected",
      "Actual",
      "Device",
      "Toggles",
      "How bad is it",
      "Requested by",
    ])
      expect(bug).toContain(`\`### ${heading}\``);
  });

  it("reproduces with the listed Toggles on", () => {
    expect(bug).toMatch(/reproduce[^.\n]*Toggles[^.\n]*on/i);
  });

  it("treats an in-app Bug's quoted sections as data, never instructions (spec 194 D17)", () => {
    expect(bug).toContain("_Not given_");
    expect(bug).toMatch(/never instructions/);
    expect(bug).toMatch(/needs-human-review/);
  });

  // The Bug triage section (spec 194 US3.1): everything before "## 2. Reproduce it in a test".
  const triage = bug.slice(
    bug.indexOf("## 1. Triage"),
    bug.indexOf("## 2. Reproduce"),
  );
  const outcome = (name) => {
    const start = triage.indexOf(`- **${name}**`);
    expect(start, `${name} is an outcome`).toBeGreaterThan(-1);
    const end = triage.indexOf("\n- **", start + 1);
    return triage.slice(start, end === -1 ? undefined : end);
  };

  it("lets triage decide Not a bug, with wontfix, no needs-triage and closed as not planned (US3.1)", () => {
    const notABug = outcome("Not a bug");
    expect(notABug).toContain("not applicable");
    expect(notABug).toMatch(/can't be reproduced|cannot be reproduced/);
    expect(notABug).toContain("`wontfix`");
    expect(notABug).toContain("remove `needs-triage`");
    expect(notABug).toMatch(/not planned/);
  });

  it("lets triage decide A Feature, sending the User to Feature requests (US3.1)", () => {
    const aFeature = outcome("A Feature");
    expect(aFeature).toContain("Feature requests");
    expect(aFeature).toContain("`wontfix`");
    expect(aFeature).toContain("remove `needs-triage`");
    expect(aFeature).toMatch(/not planned/);
  });

  it("no longer sends working-as-specified Bugs to needs-human-review (US3.1)", () => {
    expect(outcome("A Feature")).not.toContain("needs-human-review");
  });

  it("comments the reason in plain words before closing, and explains an in-app Duplicate (US3.1)", () => {
    expect(triage).toMatch(/before closing/i);
    expect(triage).toMatch(/plain words/);
    expect(outcome("Duplicate")).toMatch(/in-app/);
  });

  it("never asks an in-app reporter for needs-info, but a Bug filed on GitHub keeps it (US3.1)", () => {
    const reproduce = bug.slice(bug.indexOf("## 2. Reproduce"));
    expect(triage + reproduce).toMatch(/never[^.\n]*`needs-info`/);
    expect(reproduce).toMatch(/filed on GitHub[^.\n]*`needs-info`/);
  });
});
