import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureIssues } from "./feature-issues";
import { type SubmitDeps, submitFeatureRequest } from "./submit";

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID = "6f1c2a9e-1b2c-4d3e-8f90-123456789abc";
const VALID = {
  goal: "Track water as well as food",
  problem: "I forget to drink",
};

function setup(overrides: Partial<SubmitDeps> = {}) {
  const issues: FeatureIssues = {
    create: vi.fn(async () => ({ number: 321 })),
    close: vi.fn(async () => {}),
    addLabels: vi.fn(async () => {}),
  };
  const deps: SubmitDeps = {
    userId: vi.fn(async () => USER),
    insert: vi.fn(async () => ({ id: ID })),
    setIssue: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    issues,
    log: vi.fn(),
    ...overrides,
  };
  return { deps, issues };
}

describe("submitFeatureRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the Feature Issue for the request and records its number (US1.5)", async () => {
    const { deps, issues } = setup();

    expect(await submitFeatureRequest(VALID, deps)).toEqual({
      ok: true,
      id: ID,
    });
    expect(deps.insert).toHaveBeenCalledWith({
      user_id: USER,
      goal: "Track water as well as food",
      problem: "I forget to drink",
      details: null,
    });
    expect(issues.create).toHaveBeenCalledWith({
      title: "Feature: Track water as well as food",
      body: expect.stringContaining(`### Requested by\n\n${ID}\n`),
      labels: ["feature", "needs-triage", "priority:P2"],
    });
    expect(deps.setIssue).toHaveBeenCalledWith(ID, 321);
    expect(deps.remove).not.toHaveBeenCalled();
  });

  it("refuses with nobody signed in", async () => {
    const { deps } = setup({ userId: vi.fn(async () => null) });

    expect(await submitFeatureRequest(VALID, deps)).toEqual({
      ok: false,
      code: "not_found",
    });
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it("refuses an invalid form without touching anything (US1.3)", async () => {
    const { deps, issues } = setup();

    expect(await submitFeatureRequest({ goal: "short" }, deps)).toEqual({
      ok: false,
      code: "invalid",
    });
    expect(deps.insert).not.toHaveBeenCalled();
    expect(issues.create).not.toHaveBeenCalled();
  });

  it("says when the User already has 2 open requests (US1.7)", async () => {
    const { deps, issues } = setup({
      insert: vi.fn(async () => "limit" as const),
    });

    expect(await submitFeatureRequest(VALID, deps)).toEqual({
      ok: false,
      code: "limit",
    });
    expect(issues.create).not.toHaveBeenCalled();
  });

  it("keeps no request when GitHub refuses (US1.9)", async () => {
    const { deps, issues } = setup();
    vi.mocked(issues.create).mockRejectedValue(new Error("GitHub said 502"));

    expect(await submitFeatureRequest(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(deps.remove).toHaveBeenCalledWith(ID);
    expect(deps.setIssue).not.toHaveBeenCalled();
  });

  it("closes the Issue again when its number cannot be recorded, so none is left orphaned", async () => {
    const { deps, issues } = setup({
      setIssue: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });

    expect(await submitFeatureRequest(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(issues.close).toHaveBeenCalledWith(
      321,
      "Not recorded in the app; please ask again.",
    );
    expect(deps.remove).toHaveBeenCalledWith(ID);
    expect(deps.log).toHaveBeenCalledWith(
      expect.stringContaining("321"),
      expect.anything(),
    );
  });

  it("is unavailable when the request cannot be stored", async () => {
    const { deps, issues } = setup({
      insert: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });

    expect(await submitFeatureRequest(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(issues.create).not.toHaveBeenCalled();
  });
});
