import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DecideDeps, decide } from "./decide";
import type { FeatureIssues } from "./feature-issues";
import { cleanupChore } from "./issue-body";

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID = "6f1c2a9e-1b2c-4d3e-8f90-123456789abc";

function setup(overrides: Partial<DecideDeps> = {}) {
  const issues: FeatureIssues = {
    create: vi.fn(async () => ({ number: 901 })),
    close: vi.fn(async () => {}),
    addLabels: vi.fn(async () => {}),
  };
  const deps: DecideDeps = {
    toggleOn: vi.fn(async () => true),
    userId: vi.fn(async () => USER),
    find: vi.fn(async () => ({ featureIssue: 801 })),
    record: vi.fn(async () => true),
    recordedChore: vi.fn(async () => null),
    issues,
    log: vi.fn(),
    ...overrides,
  };
  return { deps, issues };
}

describe("decide: It's ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the Toggle-removal Chore first, then sets the Toggle Live (US2.1, D4)", async () => {
    const order: string[] = [];
    const { deps, issues } = setup();
    vi.mocked(issues.create).mockImplementation(async () => {
      order.push("chore");
      return { number: 901 };
    });
    vi.mocked(deps.record).mockImplementation(async () => {
      order.push("live");
      return true;
    });

    expect(await decide({ id: ID }, "ready", deps)).toEqual({ ok: true });
    expect(order).toEqual(["chore", "live"]);
    expect(deps.find).toHaveBeenCalledWith(ID, USER);
    expect(issues.create).toHaveBeenCalledWith(cleanupChore("ready", 801));
    expect(deps.record).toHaveBeenCalledWith(ID, USER, "ready", 901);
    expect(issues.close).not.toHaveBeenCalled();
  });

  it("makes the Chore ready-for-agent only once the Toggle is Live", async () => {
    const order: string[] = [];
    const { deps, issues } = setup();
    vi.mocked(deps.record).mockImplementation(async () => {
      order.push("live");
      return true;
    });
    vi.mocked(issues.addLabels).mockImplementation(async () => {
      order.push("label");
    });

    expect(await decide({ id: ID }, "ready", deps)).toEqual({ ok: true });
    expect(order).toEqual(["live", "label"]);
    expect(issues.addLabels).toHaveBeenCalledWith(901, ["ready-for-agent"]);
  });

  it("still says it is Live when the label cannot be added, and logs it", async () => {
    const { deps, issues } = setup();
    vi.mocked(issues.addLabels).mockRejectedValueOnce(new Error("GitHub down"));

    expect(await decide({ id: ID }, "ready", deps)).toEqual({ ok: true });
    expect(deps.log).toHaveBeenCalledWith(
      "clean-up Chore #901 is not ready-for-agent; label it by hand",
      expect.any(Error),
    );
  });

  it("leaves the Chore open and unlabelled when it can't tell whether the decision landed", async () => {
    const { deps, issues } = setup({
      record: vi.fn(async () => {
        throw new Error("response lost");
      }),
      recordedChore: vi.fn(async () => {
        throw new Error("still down");
      }),
    });

    expect(await decide({ id: ID }, "ready", deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(issues.close).not.toHaveBeenCalled();
    expect(issues.addLabels).not.toHaveBeenCalled();
  });

  it("changes nothing when the Chore cannot be created (US2.2)", async () => {
    const { deps, issues } = setup();
    vi.mocked(issues.create).mockRejectedValueOnce(new Error("GitHub down"));

    expect(await decide({ id: ID }, "ready", deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(deps.record).not.toHaveBeenCalled();
  });

  it("closes the Chore again when the Toggle is no longer in Testing (US2.3)", async () => {
    const { deps, issues } = setup({ record: vi.fn(async () => false) });

    expect(await decide({ id: ID }, "ready", deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
    expect(issues.close).toHaveBeenCalledWith(
      901,
      "The Toggle was no longer in Testing.",
    );
    expect(issues.addLabels).not.toHaveBeenCalled();
  });

  it("closes the Chore again when recording fails and the decision did not land", async () => {
    const { deps, issues } = setup({
      record: vi.fn(async () => {
        throw new Error("database down");
      }),
    });

    expect(await decide({ id: ID }, "ready", deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(deps.recordedChore).toHaveBeenCalledWith(ID);
    expect(issues.close).toHaveBeenCalledWith(
      901,
      "Not recorded in the app; the Toggle is still in Testing.",
    );
  });

  it("keeps the Chore when recording seemed to fail but the decision landed", async () => {
    const { deps, issues } = setup({
      record: vi.fn(async () => {
        throw new Error("response lost");
      }),
      recordedChore: vi.fn(async () => 901),
    });

    expect(await decide({ id: ID }, "ready", deps)).toEqual({ ok: true });
    expect(issues.close).not.toHaveBeenCalled();
    expect(issues.addLabels).toHaveBeenCalledWith(901, ["ready-for-agent"]);
  });

  it("refuses a request that may not be decided, before creating anything (FR-001)", async () => {
    const { deps, issues } = setup({ find: vi.fn(async () => null) });

    expect(await decide({ id: ID }, "ready", deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
    expect(issues.create).not.toHaveBeenCalled();
  });

  it("refuses while Feature Requests are off, signed out, or for an id that is not one", async () => {
    const off = setup({ toggleOn: vi.fn(async () => false) });
    expect(await decide({ id: ID }, "ready", off.deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
    const signedOut = setup({ userId: vi.fn(async () => null) });
    expect(await decide({ id: ID }, "ready", signedOut.deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
    const bad = setup();
    expect(await decide({ id: "801" }, "ready", bad.deps)).toEqual({
      ok: false,
      code: "not_allowed",
    });
    expect(off.deps.find).not.toHaveBeenCalled();
    expect(bad.deps.find).not.toHaveBeenCalled();
  });
});

describe("cleanupChore: It's ready", () => {
  it("asks for the Toggle's checks to go, keeping the on path and the Toggle's row (US2.1, D11)", () => {
    const chore = cleanupChore("ready", 801);

    expect(chore.title).toBe("Chore: Remove the Toggle for #801");
    expect(chore.labels).toEqual(["chore", "priority:P2"]);
    expect(chore.body).toContain('useToggle("feature-801")');
    expect(chore.body).toContain('isToggleOn("feature-801")');
    expect(chore.body).toContain("toggle_is_on('feature-801')");
    expect(chore.body).toMatch(/keep the "on" path/);
    expect(chore.body).toMatch(/Keep the Toggle's row/);
    expect(chore.body).toContain("ADR 0008");
    expect(chore.body).toContain(
      "### Behaviour\n\n- [x] No User-visible behaviour changes.",
    );
    expect(chore.body.indexOf("### What")).toBeLessThan(
      chore.body.indexOf("### Why"),
    );
  });
});
