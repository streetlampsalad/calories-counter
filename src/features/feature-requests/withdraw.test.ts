import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureIssues } from "./feature-issues";
import { type WithdrawDeps, withdrawFeatureRequest } from "./withdraw";

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID = "6f1c2a9e-1b2c-4d3e-8f90-123456789abc";

function setup(overrides: Partial<WithdrawDeps> = {}) {
  const issues: FeatureIssues = {
    create: vi.fn(),
    close: vi.fn(async () => {}),
    addLabels: vi.fn(async () => {}),
  };
  const deps: WithdrawDeps = {
    userId: vi.fn(async () => USER),
    markWithdrawn: vi.fn(async () => ({ featureIssue: 200, specIssue: 201 })),
    unmarkWithdrawn: vi.fn(async () => {}),
    issues,
    log: vi.fn(),
    ...overrides,
  };
  return { deps, issues };
}

describe("withdrawFeatureRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the request first, then closes its Feature and Spec Issues as not planned (US4.1)", async () => {
    const { deps, issues } = setup();

    expect(await withdrawFeatureRequest({ id: ID }, deps)).toEqual({
      ok: true,
    });
    expect(deps.markWithdrawn).toHaveBeenCalledWith(ID, USER);
    expect(issues.close).toHaveBeenCalledWith(
      200,
      "Withdrawn by the requester.",
    );
    expect(issues.close).toHaveBeenCalledWith(
      201,
      "Withdrawn by the requester.",
    );
    expect(
      vi.mocked(deps.markWithdrawn).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(issues.close).mock.invocationCallOrder[0]);
  });

  it("closes only the Feature while there is no Spec yet", async () => {
    const { deps, issues } = setup({
      markWithdrawn: vi.fn(async () => ({
        featureIssue: 200,
        specIssue: null,
      })),
    });

    expect(await withdrawFeatureRequest({ id: ID }, deps)).toEqual({
      ok: true,
    });
    expect(issues.close).toHaveBeenCalledTimes(1);
    expect(issues.close).toHaveBeenCalledWith(
      200,
      "Withdrawn by the requester.",
    );
  });

  it("refuses a request past Planning, someone else's, or one already withdrawn (US4.2)", async () => {
    // markWithdrawn matches only the caller's own request at an allowed stage, not yet withdrawn,
    // in the same update, so a sync that moved it to Building since the screen loaded wins.
    const { deps, issues } = setup({ markWithdrawn: vi.fn(async () => null) });

    expect(await withdrawFeatureRequest({ id: ID }, deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
    expect(issues.close).not.toHaveBeenCalled();
  });

  it("clears the mark again when GitHub fails, so agents and the app agree", async () => {
    const { deps, issues } = setup();
    vi.mocked(issues.close).mockRejectedValue(new Error("GitHub said 502"));

    expect(await withdrawFeatureRequest({ id: ID }, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(deps.unmarkWithdrawn).toHaveBeenCalledWith(ID);
  });

  it("refuses with nobody signed in", async () => {
    for (const overrides of [{ userId: vi.fn(async () => null) }]) {
      const { deps } = setup(overrides);
      expect(await withdrawFeatureRequest({ id: ID }, deps)).toEqual({
        ok: false,
        code: "not_allowed",
      });
      expect(deps.markWithdrawn).not.toHaveBeenCalled();
    }
  });

  it("refuses anything that isn't a request id", async () => {
    const { deps } = setup();

    expect(await withdrawFeatureRequest({ id: "not-an-id" }, deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
    expect(deps.markWithdrawn).not.toHaveBeenCalled();
  });
});
