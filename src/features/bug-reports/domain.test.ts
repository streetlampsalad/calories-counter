import { describe, expect, it } from "vitest";
import {
  parseBugReport,
  SCREEN_LABELS,
  SEVERITY_OPTIONS,
  WENT_WRONG_MIN,
} from "./domain";

const valid = {
  whatWentWrong: "The Today total is wrong",
  severity: "annoying",
};

describe("parseBugReport", () => {
  it("accepts the required fields, trimmed (FR-002)", () => {
    const result = parseBugReport({
      ...valid,
      whatWentWrong: "  The Today total is wrong  ",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        whatWentWrong: "The Today total is wrong",
        severity: "annoying",
      },
    });
  });

  it("keeps the optional fields and the screen when given", () => {
    const result = parseBugReport({
      ...valid,
      expected: " A bigger number ",
      howItHappened: "Add a Food twice",
      screen: "today",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        whatWentWrong: "The Today total is wrong",
        expected: "A bigger number",
        howItHappened: "Add a Food twice",
        screen: "today",
        severity: "annoying",
      },
    });
  });

  it("treats blank optional fields as not given", () => {
    const result = parseBugReport({ ...valid, expected: "   ", screen: "" });
    expect(result).toEqual({
      ok: true,
      value: {
        whatWentWrong: "The Today total is wrong",
        severity: "annoying",
      },
    });
  });

  it("needs What went wrong of at least 10 characters after trimming (US1.3)", () => {
    expect(WENT_WRONG_MIN).toBe(10);
    for (const whatWentWrong of ["", "   ", "too short", "  123456789  "]) {
      const result = parseBugReport({ ...valid, whatWentWrong });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.errors.whatWentWrong).toBe(
          "Say what went wrong, in at least 10 characters.",
        );
    }
    expect(parseBugReport({ ...valid, whatWentWrong: "1234567890" }).ok).toBe(
      true,
    );
  });

  it("counts limits after trimming (FR-002)", () => {
    const at = (n: number) => `${"a".repeat(n)}  `;
    expect(parseBugReport({ ...valid, whatWentWrong: at(2000) }).ok).toBe(true);
    expect(parseBugReport({ ...valid, whatWentWrong: at(2001) }).ok).toBe(
      false,
    );
    expect(parseBugReport({ ...valid, expected: at(2000) }).ok).toBe(true);
    const tooLong = parseBugReport({ ...valid, expected: at(2001) });
    expect(!tooLong.ok && tooLong.errors.expected).toBe(
      "Keep this under 2,000 characters.",
    );
    expect(parseBugReport({ ...valid, howItHappened: at(4000) }).ok).toBe(true);
    const long = parseBugReport({ ...valid, howItHappened: at(4001) });
    expect(!long.ok && long.errors.howItHappened).toBe(
      "Keep this under 4,000 characters.",
    );
  });

  it("needs How bad is it to be one of the two choices (US1.3)", () => {
    for (const severity of [undefined, "", "p0", "catastrophic", 1]) {
      const result = parseBugReport({
        whatWentWrong: valid.whatWentWrong,
        severity,
      });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.errors.severity).toBe("Choose how bad it is.");
    }
    expect(parseBugReport({ ...valid, severity: "blocked" }).ok).toBe(true);
  });

  it("refuses a screen that is not one of the five", () => {
    expect(parseBugReport({ ...valid, screen: "login" }).ok).toBe(false);
  });

  it("refuses input that is not an object", () => {
    for (const input of [null, undefined, "text", 3]) {
      const result = parseBugReport(input);
      expect(result.ok).toBe(false);
    }
  });

  it("reports every field's error at once", () => {
    const result = parseBugReport({});
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(Object.keys(result.errors).sort()).toEqual([
        "severity",
        "whatWentWrong",
      ]);
  });
});

describe("choices", () => {
  it("names the screens as the form shows them", () => {
    expect(SCREEN_LABELS).toEqual({
      today: "Today",
      foods: "Foods",
      summary: "Summary",
      settings: "Settings",
      other: "Somewhere else",
    });
  });

  it("uses the Bug template's option text for the severities (D6)", () => {
    expect(SEVERITY_OPTIONS.blocked.issueText).toBe(
      "A User cannot finish a main task (P1)",
    );
    expect(SEVERITY_OPTIONS.annoying.issueText).toBe(
      "Annoying, with a workaround (P2)",
    );
    expect(SEVERITY_OPTIONS.blocked.label).toBe(
      "I can't finish what I was doing",
    );
    expect(SEVERITY_OPTIONS.annoying.label).toBe(
      "It's annoying, but I can work around it",
    );
  });
});
