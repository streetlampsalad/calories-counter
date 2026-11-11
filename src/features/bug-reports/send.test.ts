import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureIssues } from "@/features/feature-requests/feature-issues";
import type { IssueToggle } from "./issue-body";
import { type SendDeps, sendBugReport } from "./send";

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID = "6f1c2a9e-1b2c-4d3e-8f90-123456789abc";
const VALID = {
  whatWentWrong: "The Today total ignores my last Entry",
  severity: "annoying",
};
const TOGGLES: IssueToggle[] = [
  { key: "feature-192", title: "Report a bug", state: "testing" },
];

function setup(overrides: Partial<SendDeps> = {}) {
  const issues: FeatureIssues = {
    create: vi.fn(async () => ({ number: 321 })),
    close: vi.fn(async () => {}),
    addLabels: vi.fn(async () => {}),
  };
  const deps: SendDeps = {
    userId: vi.fn(async () => USER),
    toggleOn: vi.fn(async () => true),
    insert: vi.fn(async () => ({ id: ID })),
    setIssue: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    toggles: vi.fn(async () => TOGGLES),
    version: "abc1234",
    issues,
    log: vi.fn(),
    ...overrides,
  };
  return { deps, issues };
}

describe("sendBugReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the Bug Issue, records its number and returns its link (US1.6, US1.8)", async () => {
    const { deps, issues } = setup();

    expect(await sendBugReport(VALID, deps)).toEqual({
      ok: true,
      issue: 321,
      url: "https://github.com/streetlampsalad/calories-counter/issues/321",
    });
    expect(deps.insert).toHaveBeenCalledWith({ user_id: USER });
    expect(issues.create).toHaveBeenCalledWith({
      title: "Bug: The Today total ignores my last Entry",
      body: expect.stringContaining(`### Requested by\n\n${ID}\n`),
      labels: ["bug", "needs-triage"],
    });
    expect(deps.setIssue).toHaveBeenCalledWith(ID, 321);
    expect(deps.remove).not.toHaveBeenCalled();
  });

  it("puts the device in the Issue, keeping only known text fields cut to 100 characters (US2.4, US2.5)", async () => {
    const { deps, issues } = setup();

    const result = await sendBugReport(
      {
        ...VALID,
        device: {
          model: "Pixel 7",
          os: 16,
          unknown: "dropped",
          browser: "c".repeat(150),
        },
      },
      deps,
    );

    expect(result.ok).toBe(true);
    const body = vi.mocked(issues.create).mock.calls[0][0].body;
    expect(body).toContain("- App version: abc1234\n- Model: Pixel 7\n");
    expect(body).toContain(`- Browser: ${"c".repeat(100)}\n`);
    expect(body).not.toContain("Operating system");
    expect(body).not.toContain("dropped");
  });

  it("sends the app version only when there is no device, or it is the wrong type (US2.6, US2.5)", async () => {
    for (const device of [undefined, "Pixel 7", ["model"], null]) {
      const { deps, issues } = setup();
      expect(await sendBugReport({ ...VALID, device }, deps)).toMatchObject({
        ok: true,
      });
      expect(vi.mocked(issues.create).mock.calls[0][0].body).toContain(
        "### Device\n\n- App version: abc1234\n\n### Toggles",
      );
    }
  });

  it("answers not_found with nobody signed in, before anything else (US1.2)", async () => {
    const { deps } = setup({ userId: vi.fn(async () => null) });

    expect(await sendBugReport(VALID, deps)).toEqual({
      ok: false,
      code: "not_found",
    });
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it("answers not_found while the Toggle is off (US1.2, FR-001)", async () => {
    const { deps, issues } = setup({ toggleOn: vi.fn(async () => false) });

    expect(await sendBugReport(VALID, deps)).toEqual({
      ok: false,
      code: "not_found",
    });
    expect(deps.insert).not.toHaveBeenCalled();
    expect(issues.create).not.toHaveBeenCalled();
  });

  it("refuses an invalid form without touching anything (US1.3)", async () => {
    const { deps, issues } = setup();

    expect(await sendBugReport({ whatWentWrong: "short" }, deps)).toEqual({
      ok: false,
      code: "invalid",
    });
    expect(deps.insert).not.toHaveBeenCalled();
    expect(issues.create).not.toHaveBeenCalled();
  });

  it("answers limit when the database refuses a sixth in 24 hours (US1.9)", async () => {
    const { deps, issues } = setup({
      insert: vi.fn(async () => "limit" as const),
    });

    expect(await sendBugReport(VALID, deps)).toEqual({
      ok: false,
      code: "limit",
    });
    expect(issues.create).not.toHaveBeenCalled();
  });

  it("answers unavailable when the row cannot be stored", async () => {
    const { deps, issues } = setup({
      insert: vi.fn(async () => {
        throw new Error("down");
      }),
    });

    expect(await sendBugReport(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(issues.create).not.toHaveBeenCalled();
  });

  it("works out the Toggles itself and writes them, with the version, into the body (FR-004)", async () => {
    const { deps, issues } = setup();

    await sendBugReport(
      {
        ...VALID,
        toggles: [{ key: "feature-1", title: "Forged", state: "live" }],
      },
      deps,
    );

    expect(deps.toggles).toHaveBeenCalledTimes(1);
    const body = vi.mocked(issues.create).mock.calls[0]?.[0].body;
    expect(body).toContain("- Report a bug (`feature-192`): Testing");
    expect(body).not.toContain("Forged");
    expect(body).toContain("- App version: abc1234");
  });

  it("still sends when the Toggles cannot be read, saying so (edge case)", async () => {
    const { deps, issues } = setup({
      toggles: vi.fn(async () => {
        throw new Error("rpc failed");
      }),
    });

    expect(await sendBugReport(VALID, deps)).toMatchObject({ ok: true });
    expect(vi.mocked(issues.create).mock.calls[0]?.[0].body).toContain(
      "### Toggles\n\nCouldn't be read\n",
    );
    expect(deps.log).toHaveBeenCalled();
  });

  it("removes the row when GitHub refuses, keeping no Bug report (US1.10)", async () => {
    const { deps } = setup();
    vi.mocked(deps.issues.create).mockRejectedValue(new Error("403"));

    expect(await sendBugReport(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(deps.remove).toHaveBeenCalledWith(ID);
    expect(deps.setIssue).not.toHaveBeenCalled();
  });

  it("closes the Issue as not planned and removes the row when the number cannot be recorded", async () => {
    const { deps, issues } = setup({
      setIssue: vi.fn(async () => {
        throw new Error("db");
      }),
    });

    expect(await sendBugReport(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(issues.close).toHaveBeenCalledWith(
      321,
      "Couldn't be recorded by the app; the reporter was asked to try again.",
    );
    expect(deps.remove).toHaveBeenCalledWith(ID);
  });

  it("still answers unavailable when the clean-up itself fails", async () => {
    const { deps } = setup({
      setIssue: vi.fn(async () => {
        throw new Error("db");
      }),
      remove: vi.fn(async () => {
        throw new Error("db");
      }),
    });
    vi.mocked(deps.issues.close).mockRejectedValue(new Error("403"));

    expect(await sendBugReport(VALID, deps)).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});
