import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Feature Requests write Issues with these headings (spec 124 FR-011), so the Feature template and
// triage must know every one of them.
const template = readFileSync(".github/ISSUE_TEMPLATE/1-feature.yml", "utf8");
const triage = readFileSync(".claude/skills/deliver/triage.md", "utf8");
const specSkill = readFileSync(".claude/skills/deliver/spec.md", "utf8");

describe("the Feature template", () => {
  it("has an Additional details field before Requested by", () => {
    const details = template.indexOf("label: Additional details");
    const requestedBy = template.indexOf("label: Requested by");
    expect(details).toBeGreaterThan(-1);
    expect(details).toBeLessThan(requestedBy);
  });

  it("is read in full by triage", () => {
    for (const heading of [
      "Problem",
      "Who has it",
      "Desired outcome",
      "Additional details",
      "Follow-up to",
      "Requested by",
    ])
      expect(triage).toContain(`\`### ${heading}\``);
  });
});

// A Round's follow-up Feature (spec 135 US1.9) changes the feature behind its existing Toggle.
describe("follow-ups", () => {
  it("have a Follow-up to field between Additional details and Requested by", () => {
    const details = template.indexOf("label: Additional details");
    const followUp = template.indexOf("label: Follow-up to");
    const requestedBy = template.indexOf("label: Requested by");
    expect(followUp).toBeGreaterThan(details);
    expect(followUp).toBeLessThan(requestedBy);
  });

  it("reuse the original Feature's Toggle in triage and the spec, and add none", () => {
    for (const text of [triage, specSkill]) {
      expect(text).toContain("### Follow-up to");
      expect(text).toMatch(/existing Toggle `feature-<original>`/);
      expect(text).toMatch(/adds? no new Toggle/);
    }
  });
});
