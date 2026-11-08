import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleFeatureRequestSync,
  reminderFor,
  type SyncDeps,
} from "./sync-handler";

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
    devices: vi.fn(async () => []),
    send: vi.fn(async () => "sent" as const),
    deleteSubscriptions: vi.fn(async () => {}),
    dueReminders: vi.fn(async () => []),
    ...overrides,
  };
  return deps;
}

const device = (id: string, userId = "u1") => ({
  subscription_id: id,
  user_id: userId,
  endpoint: `https://push.example.test/${id}`,
  p256dh_key: "p256dh",
  auth_secret: "auth",
});

const synced = (overrides = {}) => ({
  request_id: "r1",
  requester_id: "u1",
  goal_text: "Track water as well as food",
  new_stage: "ready_to_try",
  comment: "In production since abc1234",
  notify: true,
  ...overrides,
});

describe("notifications (US3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tells each of the Requester's devices it is Ready to try, opening the request (US3.1)", async () => {
    const deps = setup({
      apply: vi.fn(async () => [synced()]),
      devices: vi.fn(async () => [device("d1"), device("d2")]),
    });

    const response = await handleFeatureRequestSync(
      post({ requests: [{ ...UPDATE, stage: "ready_to_try" }] }),
      deps,
    );

    expect(await response.json()).toEqual({
      updated: 1,
      notified: 1,
      reminded: 0,
    });
    expect(deps.devices).toHaveBeenCalledWith(["u1"]);
    expect(deps.send).toHaveBeenCalledTimes(2);
    const [, payload] = vi.mocked(deps.send).mock.calls[0];
    expect(JSON.parse(payload)).toEqual({
      title: "Ready to try: Track water as well as food",
      body: "Turn it on to try it.",
      url: "/settings/feature-requests#r1",
    });
  });

  it("says when it is Not going ahead, with the start of the reason (US3.2)", async () => {
    const deps = setup({
      apply: vi.fn(async () => [
        synced({
          new_stage: "not_going_ahead",
          comment: "A duplicate of the Meal groups request.",
        }),
      ]),
      devices: vi.fn(async () => [device("d1")]),
    });

    await handleFeatureRequestSync(post({ requests: [UPDATE] }), deps);

    const [, payload] = vi.mocked(deps.send).mock.calls[0];
    expect(JSON.parse(payload)).toEqual({
      title: "Not going ahead: Track water as well as food",
      body: "A duplicate of the Meal groups request.",
      url: "/settings/feature-requests#r1",
    });
  });

  it("sends nothing for a request that isn't due one (US3.3)", async () => {
    const deps = setup({
      apply: vi.fn(async () => [synced({ notify: false })]),
    });

    const response = await handleFeatureRequestSync(
      post({ requests: [UPDATE] }),
      deps,
    );

    expect(await response.json()).toEqual({
      updated: 1,
      notified: 0,
      reminded: 0,
    });
    expect(deps.devices).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("shortens a long goal in the title", async () => {
    const deps = setup({
      apply: vi.fn(async () => [
        synced({ goal_text: `${"word ".repeat(30)}end\nsecond line` }),
      ]),
      devices: vi.fn(async () => [device("d1")]),
    });

    await handleFeatureRequestSync(post({ requests: [UPDATE] }), deps);

    const { title } = JSON.parse(vi.mocked(deps.send).mock.calls[0][1]);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("…")).toBe(true);
  });

  it("forgets devices the push service says are gone, and still answers 200", async () => {
    const deps = setup({
      apply: vi.fn(async () => [synced()]),
      devices: vi.fn(async () => [device("d1"), device("d2")]),
      send: vi.fn(async (target) =>
        target.subscription_id === "d1" ? "expired" : "sent",
      ),
    });

    const response = await handleFeatureRequestSync(
      post({ requests: [UPDATE] }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(deps.deleteSubscriptions).toHaveBeenCalledWith(["d1"]);
  });

  it("still records the stages when notifying fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = setup({
      apply: vi.fn(async () => [synced()]),
      devices: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });

    const response = await handleFeatureRequestSync(
      post({ requests: [UPDATE] }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      updated: 1,
      notified: 0,
      reminded: 0,
    });
  });
});

describe("handleFeatureRequestSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records every request's stage (US2.1)", async () => {
    const deps = setup();
    const response = await handleFeatureRequestSync(
      post({ requests: [UPDATE] }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      updated: 1,
      notified: 0,
      reminded: 0,
    });
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

describe("the reminder to decide (spec 135 US4)", () => {
  beforeEach(() => vi.clearAllMocks());

  const due = {
    request_id: "r9",
    requester_id: "u1",
    goal_text: "Track water as well as food",
  };

  it("asks the Requester to decide, opening the request (US4.1)", () => {
    expect(reminderFor(due)).toEqual({
      title: "Still trying: Track water as well as food?",
      body: "Mark it ready, give feedback or remove it.",
      url: "/settings/feature-requests#r9",
    });
  });

  it("is sent to each of the Requester's devices on a sync, and counted (US4.1)", async () => {
    const deps = setup({
      apply: vi.fn(async () => []),
      devices: vi.fn(async () => [device("d1"), device("d2")]),
      dueReminders: vi.fn(async () => [due]),
    });

    const response = await handleFeatureRequestSync(
      post({ requests: [] }),
      deps,
    );

    expect(await response.json()).toEqual({
      updated: 0,
      notified: 0,
      reminded: 1,
    });
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(vi.mocked(deps.send).mock.calls[0][1])).toEqual(
      reminderFor(due),
    );
  });

  it("never fails the sync when the reminders can't be read", async () => {
    const deps = setup({
      dueReminders: vi.fn(async () => {
        throw new Error("database down");
      }),
    });

    const response = await handleFeatureRequestSync(
      post({ requests: [UPDATE] }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      updated: 1,
      notified: 0,
      reminded: 0,
    });
  });

  it("is not asked for before the secret is checked", async () => {
    const deps = setup();

    await handleFeatureRequestSync(post({ requests: [] }, "wrong"), deps);

    expect(deps.dueReminders).not.toHaveBeenCalled();
  });
});
