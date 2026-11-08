import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleFeatureRequestSync, type SyncDeps } from "./sync-handler";

const SECRET = "a-long-shared-secret";
const UPDATE = {
  featureIssue: 501,
  stage: "planning",
  specIssue: 601,
  latestComment: "Accepted: specified in #601",
  readyNote: null,
};

function post(body: unknown, secret: string | null = SECRET) {
  return new Request("https://app.test/api/feature-requests/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === null ? {} : { "x-sync-secret": secret }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function setup(overrides: Partial<SyncDeps> = {}) {
  const deps: SyncDeps = {
    secret: SECRET,
    apply: vi.fn(async () => [
      {
        request_id: "r1",
        requester_id: "u1",
        goal_text: "Track water",
        new_stage: "planning",
        comment: null,
        notify: false,
      },
    ]),
    ...overrides,
  };
  return deps;
}

describe("handleFeatureRequestSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records every request's stage (US2.1)", async () => {
    const deps = setup();
    const response = await handleFeatureRequestSync(
      post({ requests: [UPDATE] }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 1, notified: 0 });
    expect(deps.apply).toHaveBeenCalledWith([UPDATE]);
  });

  it("refuses a missing or wrong secret, before touching anything (US2.3)", async () => {
    const deps = setup();

    for (const secret of [null, "", "not-the-secret"]) {
      const response = await handleFeatureRequestSync(
        post({ requests: [UPDATE] }, secret),
        deps,
      );
      expect(response.status).toBe(401);
    }
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("refuses everyone while the app has no secret set (US2.3)", async () => {
    const deps = setup({ secret: undefined });

    expect(
      (await handleFeatureRequestSync(post({ requests: [UPDATE] }, ""), deps))
        .status,
    ).toBe(401);
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't a list of stages", async () => {
    const deps = setup();
    const bad = [
      "not json",
      { requests: [{ ...UPDATE, stage: "live" }] },
      { requests: [{ ...UPDATE, featureIssue: "501" }] },
      { requests: Array.from({ length: 201 }, () => UPDATE) },
      {},
    ];

    for (const body of bad) {
      expect((await handleFeatureRequestSync(post(body), deps)).status).toBe(
        400,
      );
    }
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("answers 500 when the database can't record them", async () => {
    const deps = setup({
      apply: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      (await handleFeatureRequestSync(post({ requests: [UPDATE] }), deps))
        .status,
    ).toBe(500);
  });
});
