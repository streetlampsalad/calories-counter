import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The agent instruction files point at each other (Issue #184). These keep the pointers alive.
const read = (path) => readFileSync(path, "utf8");
const deliver = read(".claude/skills/deliver/SKILL.md");

describe("a pull request that needs Human review", () => {
  const parts = [
    "Why a human",
    "In plain words",
    "How it works",
    "Read first",
    "If it goes wrong",
  ];

  it("has a For the reviewer section in the template, before the Risk assessment", () => {
    const template = read(".github/pull_request_template.md");
    const section = template.indexOf("## For the reviewer");
    expect(section).toBeGreaterThan(-1);
    expect(section).toBeLessThan(template.indexOf("## Risk assessment"));
    for (const part of parts) expect(template).toContain(`**${part}**`);
  });

  it("is explained to /deliver part by part, in plain words and pseudocode", () => {
    const guide = read(".claude/skills/deliver/pull-request.md");
    for (const part of parts) expect(guide).toContain(`**${part}**`);
    expect(guide).toContain("plain words");
    expect(guide).toContain("pseudocode");
    expect(deliver).toContain("(pull-request.md)");
  });
});

describe("the review checklist", () => {
  it("is what /deliver's self-review and the Claude review both apply", () => {
    expect(deliver).toContain("(review.md)");
    expect(read(".github/workflows/claude-review.yml")).toContain(
      ".claude/skills/deliver/review.md",
    );
  });
});

describe("/deliver's routes", () => {
  it("each lead to a file that exists", () => {
    const files = [...deliver.matchAll(/\]\(([a-z-]+\.md)\)/g)].map(
      (match) => match[1],
    );
    expect(files).toContain("bug.md");
    for (const file of new Set(files))
      expect(() => read(`.claude/skills/deliver/${file}`)).not.toThrow();
  });
});
