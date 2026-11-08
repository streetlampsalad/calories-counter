import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Feature Requests write Issues with these headings (spec 124 FR-011), so the Feature template and
// triage must know every one of them.
const template = readFileSync(".github/ISSUE_TEMPLATE/1-feature.yml", "utf8");
const triage = readFileSync(".claude/skills/deliver/triage.md", "utf8");

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
      "Requested by",
    ])
      expect(triage).toContain(`\`### ${heading}\``);
  });
});
