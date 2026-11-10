import { describe, expect, it } from "vitest";
import {
  countOpen,
  MAX_OPEN,
  MAX_SETS,
  parseFeatureRequest,
  parseSets,
  wantsMoreDetail,
} from "./domain";

describe("parseFeatureRequest", () => {
  it("accepts a goal alone, trimming it and dropping empty optional fields", () => {
    expect(
      parseFeatureRequest({
        goal: "  Track water as well as food ",
        problem: " ",
        details: "",
      }),
    ).toEqual({
      ok: true,
      value: {
        goal: "Track water as well as food",
        problem: undefined,
        details: undefined,
      },
    });
  });

  it("needs a goal (US1.3)", () => {
    const result = parseFeatureRequest({ goal: "" });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.goal).toBe(
        "Say what you'd like to be able to do, in at least 10 characters.",
      );
  });

  it("needs at least 10 characters of goal, not counting spaces around it (US1.3)", () => {
    expect(parseFeatureRequest({ goal: "   too short   " }).ok).toBe(false);
    expect(parseFeatureRequest({ goal: "ten chars!" }).ok).toBe(true);
  });

  it("caps each field", () => {
    const result = parseFeatureRequest({
      goal: "x".repeat(2001),
      problem: "y".repeat(4001),
      details: "z".repeat(4001),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.goal).toBe("Keep this under 2,000 characters.");
      expect(result.errors.problem).toBe("Keep this under 4,000 characters.");
      expect(result.errors.details).toBe("Keep this under 4,000 characters.");
    }
  });

  it("refuses anything that isn't a form", () => {
    expect(parseFeatureRequest(null).ok).toBe(false);
    expect(parseFeatureRequest({ goal: 42 }).ok).toBe(false);
  });
});

describe("wantsMoreDetail", () => {
  it("is true under 100 characters in all, and false from 100 (US1.4)", () => {
    expect(
      wantsMoreDetail({ goal: "x".repeat(60), problem: "y".repeat(39) }),
    ).toBe(true);
    expect(
      wantsMoreDetail({ goal: "x".repeat(60), problem: "y".repeat(40) }),
    ).toBe(false);
    expect(
      wantsMoreDetail({ goal: "x".repeat(50), details: "z".repeat(50) }),
    ).toBe(false);
  });
});

describe("countOpen", () => {
  it("counts requests agents are still working on, not withdrawn ones (US1.7)", () => {
    expect(MAX_OPEN).toBe(2);
    expect(
      countOpen([
        { stage: "submitted", withdrawnAt: null },
        { stage: "building", withdrawnAt: null },
        { stage: "waiting_for_owner", withdrawnAt: null },
        { stage: "planning", withdrawnAt: "2026-11-08T00:00:00Z" },
        { stage: "ready_to_try", withdrawnAt: null },
        { stage: "not_going_ahead", withdrawnAt: null },
      ]),
    ).toBe(3);
  });
});

describe("parseSets", () => {
  it("accepts 1 to 5 sets in order, trimmed, each an enhancement or a bug (FR-001)", () => {
    expect(MAX_SETS).toBe(5);
    expect(
      parseSets([
        { category: "bug", text: "  The glass button does nothing " },
        { category: "enhancement", text: "Let me add half a glass" },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { category: "bug", text: "The glass button does nothing" },
        { category: "enhancement", text: "Let me add half a glass" },
      ],
    });
  });

  it("says which set needs more, under 10 characters (US1.5)", () => {
    expect(
      parseSets([
        { category: "bug", text: "The glass button does nothing" },
        { category: "enhancement", text: " more " },
      ]),
    ).toEqual({
      ok: false,
      errors: [
        undefined,
        "Set 2: say what should change, in at least 10 characters.",
      ],
    });
  });

  it("refuses a set over 4,000 characters, or with another category (US1.8)", () => {
    const result = parseSets([
      { category: "enhancement", text: "x".repeat(4001) },
      { category: "wish", text: "Let me add half a glass" },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: [
        "Set 1: keep this under 4,000 characters.",
        "Set 2: choose Enhancement or Bug.",
      ],
    });
    expect(
      parseSets([{ category: "enhancement", text: "x".repeat(4000) }]).ok,
    ).toBe(true);
  });

  it("refuses no set, more than 5, or something that is not a list (US1.8)", () => {
    const set = { category: "enhancement", text: "Let me add half a glass" };
    expect(parseSets([]).ok).toBe(false);
    expect(parseSets(Array(6).fill(set)).ok).toBe(false);
    expect(parseSets(Array(5).fill(set)).ok).toBe(true);
    expect(parseSets("Let me add half a glass").ok).toBe(false);
    expect(parseSets(undefined).ok).toBe(false);
    expect(parseSets([null]).ok).toBe(false);
  });
});
