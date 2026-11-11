import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleBugReportSync,
  notificationFor,
  type SyncDeps,
} from "./sync-handler";

const SECRET = "a-long-shared-secret";
const ID = "11111111-2222-4333-8444-555555555555";
const UPDATE = {
  id: ID,
  bug_issue: 301,
  outcome: "fixed",
  issue_title: "Bug: it broke",
  latest_comment: null,
};

function post(body: unknown, secret: string | null = SECRET) {
  return new Request("https://app.test/api/bug-reports/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === null ? {} : { "x-sync-secret": secret }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const changed = (overrides = {}) => ({
  id: ID,
  user_id: "u1",
  new_outcome: "fixed",
  issue_title: "Bug: it broke",
  latest_comment: null,
  ...overrides,
});

const device = (id: string, userId = "u1") => ({
  subscription_id: id,
  user_id: userId,
  endpoint: `https://push.example.test/${id}`,
  p256dh_key: "p256dh",
  auth_secret: "auth",
});

function setup(overrides: Partial<SyncDeps> = {}) {
  const deps: SyncDeps = {
    secret: SECRET,
    apply: vi.fn(async () => []),
    devices: vi.fn(async () => []),
    send: vi.fn(async () => "sent" as const),
    deleteSubscriptions: vi.fn(async () => {}),
    ...overrides,
  };
  return deps;
}

describe("the Bug report sync handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a wrong or missing secret before touching the database (US3.4)", async () => {
    const deps = setup();

    for (const secret of ["wrong", "", null]) {
      const response = await handleBugReportSync(
        post({ updates: [UPDATE] }, secret),
        deps,
      );
      expect(response.status).toBe(401);
    }
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("refuses everything while no secret is set (US3.4)", async () => {
    const deps = setup({ secret: undefined });

    const response = await handleBugReportSync(
      post({ updates: [UPDATE] }, ""),
      deps,
    );

    expect(response.status).toBe(401);
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("rejects a body that is not updates, or has a bad field or outcome", async () => {
    const deps = setup();

    for (const body of [
      "not json",
      { requests: [] },
      { updates: [{ ...UPDATE, outcome: "invented" }] },
      { updates: [{ ...UPDATE, id: "nope" }] },
      { updates: [{ ...UPDATE, bug_issue: "301" }] },
      { updates: [{ ...UPDATE, issue_title: undefined }] },
    ]) {
      const response = await handleBugReportSync(post(body), deps);
      expect(response.status).toBe(400);
    }
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("applies the updates and answers how many it applied and notified (US3.3)", async () => {
    const deps = setup({ apply: vi.fn(async () => [changed()]) });
    deps.devices = vi.fn(async () => [device("d1")]);

    const response = await handleBugReportSync(
      post({ updates: [UPDATE, { ...UPDATE, outcome: "being_fixed" }] }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ applied: 2, notified: 1 });
    expect(deps.apply).toHaveBeenCalledWith([
      UPDATE,
      { ...UPDATE, outcome: "being_fixed" },
    ]);
  });

  it("tells each of the User's devices Fixed, opening the report (US3.7)", async () => {
    const deps = setup({
      apply: vi.fn(async () => [changed()]),
      devices: vi.fn(async () => [device("d1"), device("d2")]),
    });

    await handleBugReportSync(post({ updates: [UPDATE] }), deps);

    expect(deps.devices).toHaveBeenCalledWith(["u1"]);
    expect(deps.send).toHaveBeenCalledTimes(2);
    const [, payload] = vi.mocked(deps.send).mock.calls[0];
    expect(JSON.parse(payload)).toEqual({
      title: "Fixed: Bug: it broke",
      body: "Open it to see why.",
      url: `/settings/report-a-bug#${ID}`,
    });
  });

  it("tells them Not going ahead with the start of the reason (US3.7)", async () => {
    const reason = "That is how it is meant to work. ".repeat(10);
    expect(
      notificationFor(
        changed({ new_outcome: "not_going_ahead", latest_comment: reason }),
      ),
    ).toEqual({
      title: "Not going ahead: Bug: it broke",
      body: reason.slice(0, 120),
      url: `/settings/report-a-bug#${ID}`,
    });
  });

  it("shortens a long title at a word to 60 characters (US3.7)", () => {
    const { title } = notificationFor(
      changed({
        issue_title:
          "Bug: the food list shows the wrong calories after I edit a portion twice",
      }),
    );
    expect(title).toBe(
      "Fixed: Bug: the food list shows the wrong calories after I edit a…",
    );
  });

  it("falls back when there is no title", () => {
    expect(notificationFor(changed({ issue_title: null })).title).toBe(
      "Fixed: Your bug report",
    );
  });

  it("notifies nobody when nothing changed into Fixed or Not going ahead (US3.7)", async () => {
    const deps = setup({ apply: vi.fn(async () => []) });

    const response = await handleBugReportSync(
      post({ updates: [UPDATE] }),
      deps,
    );

    expect(await response.json()).toEqual({ applied: 1, notified: 0 });
    expect(deps.devices).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("deletes subscriptions the push service says are gone", async () => {
    const deps = setup({
      apply: vi.fn(async () => [changed()]),
      devices: vi.fn(async () => [device("d1"), device("d2")]),
      send: vi.fn(async (target) =>
        target.subscription_id === "d2"
          ? ("expired" as const)
          : ("sent" as const),
      ),
    });

    await handleBugReportSync(post({ updates: [UPDATE] }), deps);

    expect(deps.deleteSubscriptions).toHaveBeenCalledWith(["d2"]);
  });

  it("answers 500 when the outcomes cannot be recorded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = setup({
      apply: vi.fn(async () => {
        throw new Error("down");
      }),
    });

    const response = await handleBugReportSync(
      post({ updates: [UPDATE] }),
      deps,
    );

    expect(response.status).toBe(500);
  });
});
