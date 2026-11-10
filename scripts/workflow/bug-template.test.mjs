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
});
