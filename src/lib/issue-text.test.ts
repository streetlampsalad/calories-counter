import { describe, expect, it } from "vitest";
import { cutTitle, NOT_GIVEN, neutralise, quote } from "./issue-text";

describe("neutralise", () => {
  it("breaks mentions and references with a zero-width space", () => {
    expect(neutralise("Ping @streetlampsalad about #12")).toBe(
      "Ping @​streetlampsalad about #​12",
    );
  });

  it("leaves a lone @ or # alone", () => {
    expect(neutralise("a @ b # c")).toBe("a @ b # c");
  });
});

describe("quote", () => {
  it("quotes every line, so text cannot add a heading", () => {
    expect(quote("one\n### Heading\n\nthree")).toBe(
      "> one\n> ### Heading\n>\n> three",
    );
  });

  it("says _Not given_ for empty or missing text", () => {
    expect(quote("   ")).toBe(NOT_GIVEN);
    expect(quote(undefined)).toBe("_Not given_");
  });

  it("neutralises mentions and references", () => {
    expect(quote("@owner see #3")).toBe("> @​owner see #​3");
  });
});

describe("cutTitle", () => {
  it("is the prefix and the first line", () => {
    expect(cutTitle("Bug: ", "It crashes\nmore")).toBe("Bug: It crashes");
  });

  it("cuts at a word within 70 characters", () => {
    const title = cutTitle(
      "Feature: ",
      "Let me group the foods I eat together into meals so that logging breakfast is one tap",
    );
    expect(title).toBe(
      "Feature: Let me group the foods I eat together into meals so that…",
    );
    expect(title.length).toBeLessThanOrEqual(70);
  });
});
