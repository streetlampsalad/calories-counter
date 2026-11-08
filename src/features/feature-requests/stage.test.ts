import { describe, expect, it } from "vitest";
import {
  canDecide,
  canWithdraw,
  displayStage,
  issueUrl,
  STAGE_TEXT,
} from "./stage";

const request = (overrides = {}) => ({
  stage: "building" as const,
  featureIssue: 200,
  withdrawnAt: null,
  ...overrides,
});

describe("displayStage", () => {
  it("is the stage GitHub implies", () => {
    expect(displayStage(request(), [])).toBe("building");
  });

  it("is Live for everyone or Removed once its Toggle says so, whatever GitHub says (US2.2)", () => {
    expect(
      displayStage(request({ stage: "ready_to_try" }), [
        { key: "feature-200", state: "live" },
      ]),
    ).toBe("live");
    expect(
      displayStage(request({ stage: "ready_to_try" }), [
        { key: "feature-200", state: "removed" },
      ]),
    ).toBe("removed");
    expect(
      displayStage(request({ stage: "ready_to_try" }), [
        { key: "feature-200", state: "testing" },
      ]),
    ).toBe("ready_to_try");
    expect(
      displayStage(request({ stage: "ready_to_try" }), [
        { key: "feature-201", state: "live" },
      ]),
    ).toBe("ready_to_try");
  });

  it("is Withdrawn once withdrawn, before anything else", () => {
    expect(
      displayStage(request({ withdrawnAt: "2026-11-08T00:00:00Z" }), [
        { key: "feature-200", state: "live" },
      ]),
    ).toBe("withdrawn");
  });
});

describe("STAGE_TEXT", () => {
  it("names every stage in plain words", () => {
    expect(STAGE_TEXT).toEqual({
      submitted: "Submitted",
      being_reviewed: "Being reviewed",
      planning: "Planning",
      building: "Building",
      waiting_for_owner: "Waiting for the owner",
      ready_to_try: "Ready to try",
      not_going_ahead: "Not going ahead",
      live: "Live for everyone",
      removed: "Removed",
      withdrawn: "Withdrawn",
    });
  });
});

describe("issueUrl", () => {
  it("links to the Feature Issue", () => {
    expect(issueUrl(200)).toBe(
      "https://github.com/streetlampsalad/calories-counter/issues/200",
    );
  });
});

describe("canWithdraw", () => {
  it("is only before building starts (US4.1, US4.2)", () => {
    expect(canWithdraw("submitted", null)).toBe(true);
    expect(canWithdraw("being_reviewed", null)).toBe(true);
    expect(canWithdraw("planning", null)).toBe(true);
    for (const stage of [
      "building",
      "waiting_for_owner",
      "ready_to_try",
      "not_going_ahead",
      "live",
      "removed",
      "withdrawn",
    ] as const)
      expect(canWithdraw(stage, null)).toBe(false);
  });
});

describe("canDecide", () => {
  it("is only at Ready to try with the Toggle in Testing (US1.1, US1.8)", () => {
    expect(canDecide("ready_to_try", { state: "testing" })).toBe(true);
    expect(canDecide("ready_to_try", undefined)).toBe(false);
    expect(canDecide("live", { state: "live" })).toBe(false);
    expect(canDecide("removed", { state: "removed" })).toBe(false);
    expect(canDecide("building", { state: "testing" })).toBe(false);
    expect(canDecide("submitted", { state: "testing" })).toBe(false);
  });

  it("is also after a Round was declined, once the request has been Ready to try (D13)", () => {
    expect(
      canDecide(
        "not_going_ahead",
        { state: "testing" },
        "2026-11-01T00:00:00Z",
      ),
    ).toBe(true);
    expect(canDecide("not_going_ahead", { state: "testing" }, null)).toBe(
      false,
    );
  });
});

describe("canWithdraw once Ready to try", () => {
  it("is never once the request has been Ready to try, even back at Submitted for a Round (US1.11)", () => {
    expect(canWithdraw("submitted", "2026-11-01T00:00:00Z")).toBe(false);
    expect(canWithdraw("planning", "2026-11-01T00:00:00Z")).toBe(false);
    expect(canWithdraw("submitted", null)).toBe(true);
  });
});
