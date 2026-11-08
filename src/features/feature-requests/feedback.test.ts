import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureIssues } from "./feature-issues";
import { type FeedbackDeps, giveFeedback } from "./feedback";

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID = "6f1c2a9e-1b2c-4d3e-8f90-123456789abc";
const ROUND = "7a2d3b0f-2c3d-4e4f-9a01-23456789abcd";
const VALID = { id: ID, feedback: "Let me add half a glass" };
const BEFORE = {
  stage: "ready_to_try" as const,
  stageChangedAt: "2026-11-01T00:00:00Z",
  latestComment: "In production",
  readyNote: "Tap Water to add a glass.",
};

function setup(overrides: Partial<FeedbackDeps> = {}) {
  const issues: FeatureIssues = {
    create: vi.fn(async () => ({ number: 811 })),
    close: vi.fn(async () => {}),
    addLabels: vi.fn(async () => {}),
  };
  const deps: FeedbackDeps = {
    toggleOn: vi.fn(async () => true),
    userId: vi.fn(async () => USER),
    startRound: vi.fn(async () => ({
      roundId: ROUND,
      round: 2,
      goal: "Track water as well as food",
      featureIssue: 801,
      previous: BEFORE,
    })),
    setRoundIssue: vi.fn(async () => {}),
    undoRound: vi.fn(async () => {}),
    issues,
    log: vi.fn(),
    ...overrides,
  };
  return { deps, issues };
}

describe("giveFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a Round and creates its follow-up Feature Issue (US1.3)", async () => {
    const { deps, issues } = setup();

    expect(await giveFeedback(VALID, deps)).toEqual({ ok: true });
    expect(deps.startRound).toHaveBeenCalledWith(
      ID,
      USER,
      "Let me add half a glass",
    );
    expect(issues.create).toHaveBeenCalledWith({
      title: "Feature: Feedback on Track water as well as food",
      body: expect.stringContaining(
        `### Follow-up to\n\n#801\n\n### Requested by\n\n${ID}\n`,
      ),
      labels: ["feature", "needs-triage", "priority:P1"],
    });
    expect(deps.setRoundIssue).toHaveBeenCalledWith(ROUND, 811);
    expect(deps.undoRound).not.toHaveBeenCalled();
  });

  it("sends nothing under 10 characters (US1.2)", async () => {
    const { deps } = setup();

    expect(await giveFeedback({ id: ID, feedback: "  more  " }, deps)).toEqual({
      ok: false,
      code: "invalid",
    });
    expect(deps.startRound).not.toHaveBeenCalled();
  });

  it("refuses while Feature Requests are off for the caller, or they are signed out (FR-001)", async () => {
    const off = setup({ toggleOn: vi.fn(async () => false) });
    expect(await giveFeedback(VALID, off.deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
    expect(off.deps.startRound).not.toHaveBeenCalled();

    const signedOut = setup({ userId: vi.fn(async () => null) });
    expect(await giveFeedback(VALID, signedOut.deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
  });

  it("refuses a request that may not get a Round: not theirs, not Ready to try, or its Toggle not in Testing (US1.8)", async () => {
    const { deps, issues } = setup({ startRound: vi.fn(async () => null) });

    expect(await giveFeedback(VALID, deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
    expect(issues.create).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a request id", async () => {
    const { deps } = setup();

    expect(
      await giveFeedback({ id: "801", feedback: VALID.feedback }, deps),
    ).toEqual({ ok: false, code: "not_allowed" });
    expect(deps.startRound).not.toHaveBeenCalled();
  });

  it("says so when 2 other requests are being worked on (US1.7)", async () => {
    const { deps, issues } = setup({
      startRound: vi.fn(async () => "limit" as const),
    });

    expect(await giveFeedback(VALID, deps)).toEqual({
      ok: false,
      code: "limit",
    });
    expect(issues.create).not.toHaveBeenCalled();
  });

  it("undoes the Round when the Issue cannot be created", async () => {
    const { deps } = setup();
    vi.mocked(deps.issues.create).mockRejectedValueOnce(
      new Error("GitHub down"),
    );

    expect(await giveFeedback(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(deps.undoRound).toHaveBeenCalledWith(ROUND, BEFORE);
    expect(deps.setRoundIssue).not.toHaveBeenCalled();
  });

  it("closes the Issue again and undoes the Round when its number cannot be stored", async () => {
    const { deps, issues } = setup({
      setRoundIssue: vi.fn(async () => {
        throw new Error("database down");
      }),
    });

    expect(await giveFeedback(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(issues.close).toHaveBeenCalledWith(
      811,
      "Not recorded in the app; please send the feedback again.",
    );
    expect(deps.undoRound).toHaveBeenCalledWith(ROUND, BEFORE);
  });

  it("logs an undo that fails, and still answers unavailable", async () => {
    const { deps } = setup({
      undoRound: vi.fn(async () => {
        throw new Error("database down");
      }),
    });
    vi.mocked(deps.issues.create).mockRejectedValueOnce(
      new Error("GitHub down"),
    );

    expect(await giveFeedback(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(deps.log).toHaveBeenCalledWith(
      `could not undo Round ${ROUND} of request ${ID}`,
      expect.any(Error),
    );
  });

  it("is unavailable when the Round cannot be started", async () => {
    const { deps, issues } = setup({
      startRound: vi.fn(async () => {
        throw new Error("database down");
      }),
    });

    expect(await giveFeedback(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(issues.create).not.toHaveBeenCalled();
  });
});
