import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readyNote } from "./feature-requests.mjs";

// The Ready to try note a Requester reads comes from the spec (spec 124 US3.7, D6), so the template
// must have the section, /deliver must say to write it, and every spec since 124 must fill it in.
const FIRST_WITH_THE_SECTION = 124;

describe("the Ready to try section", () => {
  it("is in the spec template", () => {
    const template = readFileSync(
      ".specify/templates/overrides/spec-template.md",
      "utf8",
    );
    expect(template).toMatch(/^## Ready to try/m);
  });

  it("is something /deliver writes for every spec", () => {
    const deliver = readFileSync(".claude/skills/deliver/spec.md", "utf8");
    expect(deliver).toContain("`## Ready to try`");
  });

  it("is filled in by every spec from 124 on", () => {
    const folders = readdirSync("specs", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => Number(name.split("-")[0]) >= FIRST_WITH_THE_SECTION);

    expect(folders.length).toBeGreaterThan(0);
    for (const folder of folders) {
      const note = readyNote(readFileSync(`specs/${folder}/spec.md`, "utf8"));
      expect(
        note,
        `specs/${folder}/spec.md has no Ready to try section`,
      ).toBeTruthy();
    }
  });
});
