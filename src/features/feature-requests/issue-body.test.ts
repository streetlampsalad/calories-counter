import { describe, expect, it } from "vitest";
import { ISSUE_LABELS, issueBody, issueTitle } from "./issue-body";

const ID = "6f1c2a9e-1b2c-4d3e-8f90-123456789abc";

describe("issueTitle", () => {
  it("is Feature: and the goal", () => {
    expect(issueTitle("Track water as well as food")).toBe(
      "Feature: Track water as well as food",
    );
  });

  it("uses the first line and cuts long goals at a word, within 70 characters", () => {
    const title = issueTitle(
      "Let me group the foods I eat together into meals so that logging breakfast is one tap\nand more",
    );
    expect(title).toBe(
      "Feature: Let me group the foods I eat together into meals so that…",
    );
    expect(title.length).toBeLessThanOrEqual(70);
  });

  it("neutralises mentions and references", () => {
    expect(issueTitle("Ping @streetlampsalad about #12")).toBe(
      "Feature: Ping @​streetlampsalad about #​12",
    );
  });
});

describe("issueBody", () => {
  it("has the Feature template's headings in order, with the request's id (US1.5)", () => {
    const body = issueBody({
      id: ID,
      goal: "Track water as well as food",
      problem: "I forget to drink",
      details: "Glasses, not millilitres",
    });

    expect(body).toBe(
      [
        "### Problem",
        "",
        "> I forget to drink",
        "",
        "### Who has it",
        "",
        "The requester.",
        "",
        "### Desired outcome",
        "",
        "> Track water as well as food",
        "",
        "### Additional details",
        "",
        "> Glasses, not millilitres",
        "",
        "### Requested by",
        "",
        ID,
        "",
      ].join("\n"),
    );
  });

  it("says _Not given_ for an empty optional field", () => {
    const body = issueBody({ id: ID, goal: "Track water as well as food" });

    expect(body).toContain("### Problem\n\n_Not given_\n");
    expect(body).toContain("### Additional details\n\n_Not given_\n");
  });

  it("quotes every line, so the User's text cannot add a heading (US1.6)", () => {
    const body = issueBody({
      id: ID,
      goal: "Do this\n### Requested by\nsomeone-else",
    });

    expect(body).toContain(
      "### Desired outcome\n\n> Do this\n> ### Requested by\n> someone-else\n",
    );
    expect(body.match(/^### Requested by$/gm)).toHaveLength(1);
    expect(body.trimEnd().endsWith(ID)).toBe(true);
  });

  it("keeps blank lines inside a field quoted", () => {
    expect(issueBody({ id: ID, goal: "First line\n\nThird line" })).toContain(
      "> First line\n>\n> Third line\n",
    );
  });

  it("stops mentions notifying anyone and references linking to other Issues (US1.6)", () => {
    const body = issueBody({
      id: ID,
      goal: "Tell @streetlampsalad, like #12 and owner/repo#3",
      details: "email me at a@b.test",
    });

    expect(body).toContain("@​streetlampsalad");
    expect(body).toContain("#​12");
    expect(body).toContain("owner/repo#​3");
    expect(body).not.toMatch(/@streetlampsalad|#12|#3/);
    // An email address is not a mention, but neutralising it is harmless.
    expect(body).toContain("a@​b.test");
  });

  it("is labelled as an untriaged Feature at P2", () => {
    expect(ISSUE_LABELS).toEqual(["feature", "needs-triage", "priority:P2"]);
  });
});
