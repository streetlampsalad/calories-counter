import { describe, expect, it, vi } from "vitest";
import {
  latestComment,
  newestPerRequest,
  readyNote,
  requestedBy,
  sendSync,
  stageFor,
} from "./feature-requests.mjs";

const ID = "6f1c2a9e-1b2c-4d3e-8f90-123456789abc";

const feature = (overrides = {}) => ({
  state: "open",
  stateReason: null,
  labels: ["feature", "needs-triage"],
  assigned: false,
  ...overrides,
});
const spec = (overrides = {}) => ({
  state: "open",
  stateReason: null,
  labels: ["spec"],
  subIssues: [],
  ...overrides,
});
const slice = (overrides = {}) => ({
  state: "open",
  labels: ["slice"],
  ...overrides,
});
const tree = (overrides = {}) => ({
  feature: feature(),
  spec: null,
  openPullLabels: [],
  ...overrides,
});

describe("requestedBy", () => {
  it("finds a Feature Request's id under Requested by", () => {
    expect(
      requestedBy(`### Problem\n\n> x\n\n### Requested by\n\n${ID}\n`),
    ).toBe(ID);
  });

  it("ignores Features the owner opened, and anything that isn't an id", () => {
    expect(requestedBy("### Requested by\n\n_No response_\n")).toBeNull();
    expect(requestedBy("### Requested by\n\nsomeone\n")).toBeNull();
    expect(requestedBy("no headings at all")).toBeNull();
    expect(requestedBy(null)).toBeNull();
  });

  it("is not fooled by a quoted heading in the User's text", () => {
    const body = `### Desired outcome\n\n> ### Requested by\n> ${ID}\n\n### Requested by\n\n_No response_\n`;
    expect(requestedBy(body)).toBeNull();
  });
});

describe("stageFor (US2.1)", () => {
  it("is Submitted while untriaged and unclaimed", () => {
    expect(stageFor(tree())).toBe("submitted");
  });

  it("is Being reviewed once claimed, or once needs-triage is gone without a Spec", () => {
    expect(stageFor(tree({ feature: feature({ assigned: true }) }))).toBe(
      "being_reviewed",
    );
    expect(stageFor(tree({ feature: feature({ labels: ["feature"] }) }))).toBe(
      "being_reviewed",
    );
  });

  it("is Planning once it has a Spec with no Slices", () => {
    expect(
      stageFor(
        tree({ feature: feature({ labels: ["feature"] }), spec: spec() }),
      ),
    ).toBe("planning");
  });

  it("is Building once the Spec has Slices, until they are all in production", () => {
    expect(
      stageFor(
        tree({
          spec: spec({ subIssues: [slice({ state: "closed" }), slice()] }),
        }),
      ),
    ).toBe("building");
  });

  it("is Ready to try once the Spec or the Feature is closed as completed", () => {
    expect(
      stageFor(
        tree({
          spec: spec({
            state: "closed",
            stateReason: "completed",
            subIssues: [slice({ state: "closed" })],
          }),
        }),
      ),
    ).toBe("ready_to_try");
    expect(
      stageFor(
        tree({
          feature: feature({ state: "closed", stateReason: "completed" }),
        }),
      ),
    ).toBe("ready_to_try");
  });

  it("is Not going ahead once the Feature is closed as not planned", () => {
    expect(
      stageFor(
        tree({
          feature: feature({ state: "closed", stateReason: "not_planned" }),
          spec: spec(),
        }),
      ),
    ).toBe("not_going_ahead");
  });

  it("is Waiting for the owner while anything in the tree needs Human review (D5)", () => {
    const needs = ["needs-human-review"];
    expect(
      stageFor(tree({ feature: feature({ labels: ["feature", ...needs] }) })),
    ).toBe("waiting_for_owner");
    expect(stageFor(tree({ spec: spec({ labels: ["spec", ...needs] }) }))).toBe(
      "waiting_for_owner",
    );
    expect(
      stageFor(
        tree({
          spec: spec({ subIssues: [slice({ labels: ["slice", ...needs] })] }),
        }),
      ),
    ).toBe("waiting_for_owner");
    expect(
      stageFor(
        tree({ spec: spec(), openPullLabels: [["needs-human-review"]] }),
      ),
    ).toBe("waiting_for_owner");
  });

  it("ignores Human review on a Slice already in production", () => {
    expect(
      stageFor(
        tree({
          spec: spec({
            subIssues: [
              slice({
                state: "closed",
                labels: ["slice", "needs-human-review"],
              }),
              slice(),
            ],
          }),
        }),
      ),
    ).toBe("building");
  });

  it("lets Ready to try and Not going ahead win over Waiting for the owner (D5)", () => {
    expect(
      stageFor(
        tree({
          feature: feature({
            state: "closed",
            stateReason: "completed",
            labels: ["feature", "needs-human-review"],
          }),
        }),
      ),
    ).toBe("ready_to_try");
    expect(
      stageFor(
        tree({
          feature: feature({
            state: "closed",
            stateReason: "not_planned",
            labels: ["feature", "needs-human-review"],
          }),
        }),
      ),
    ).toBe("not_going_ahead");
  });
});

describe("latestComment", () => {
  it("is the first line of the newest comment that isn't a claim", () => {
    expect(
      latestComment([
        {
          body: "Accepted: specified in #124",
          created_at: "2026-11-08T01:00:00Z",
        },
        { body: "Claimed by /deliver", created_at: "2026-11-08T03:00:00Z" },
        {
          body: "Spec pull request: #125\n\nRisk assessment: …",
          created_at: "2026-11-08T02:00:00Z",
        },
      ]),
    ).toBe("Spec pull request: #125");
  });

  it("skips blank lines and Markdown markers, and caps the length", () => {
    expect(
      latestComment([
        {
          body: "\n\n> **Duplicate** of #12",
          created_at: "2026-11-08T01:00:00Z",
        },
      ]),
    ).toBe("**Duplicate** of #12");
    expect(
      latestComment([
        { body: "x".repeat(300), created_at: "2026-11-08T01:00:00Z" },
      ]),
    ).toHaveLength(200);
  });

  it("is null with no comments to show", () => {
    expect(latestComment([])).toBeNull();
    expect(
      latestComment([
        { body: "Claimed by /deliver", created_at: "2026-11-08T01:00:00Z" },
      ]),
    ).toBeNull();
  });
});

describe("readyNote", () => {
  it("is the spec's Ready to try section", () => {
    const md =
      "# Spec\n\n## Out of Scope\n\n- x\n\n## Ready to try\n\nOpen Settings.\n\nTry it.\n\n## Assumptions\n\n- y\n";
    expect(readyNote(md)).toBe("Open Settings.\n\nTry it.");
  });

  it("is null without one", () => {
    expect(readyNote("# Spec\n\n## Assumptions\n")).toBeNull();
    expect(readyNote(null)).toBeNull();
  });
});

describe("sendSync", () => {
  const requests = [
    {
      featureIssue: 200,
      stage: "planning",
      specIssue: 201,
      latestComment: null,
      readyNote: null,
    },
  ];

  it("posts every request's stage to the app with the shared secret", async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"updated":1}', { status: 200 }),
    );

    expect(
      await sendSync({
        url: "https://app.example.test",
        secret: "s3cret",
        requests,
        fetchImpl,
      }),
    ).toBe("sent");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://app.example.test/api/feature-requests/sync");
    expect(init.headers["x-sync-secret"]).toBe("s3cret");
    expect(JSON.parse(init.body)).toEqual({ requests });
  });

  it("skips with a warning while the secret or the app's address is missing", async () => {
    const fetchImpl = vi.fn();
    const warn = vi.fn();

    expect(
      await sendSync({
        url: "https://a.test",
        secret: "",
        requests,
        fetchImpl,
        warn,
      }),
    ).toBe("skipped");
    expect(
      await sendSync({ url: "", secret: "s", requests, fetchImpl, warn }),
    ).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("skips with a warning while the route is not deployed yet (404)", async () => {
    const warn = vi.fn();
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));

    expect(
      await sendSync({
        url: "https://a.test",
        secret: "s",
        requests,
        fetchImpl,
        warn,
      }),
    ).toBe("skipped");
    expect(warn).toHaveBeenCalled();
  });

  it("fails on any other refusal", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 401 }));

    await expect(
      sendSync({ url: "https://a.test", secret: "s", requests, fetchImpl }),
    ).rejects.toThrow("401");
  });
});

describe("newestPerRequest (spec 135 US1.4)", () => {
  const OTHER = "7a2d3b0f-2c3d-4e4f-9a01-23456789abcd";
  const issue = (number, id) => ({
    number,
    body: `### Follow-up to

#1

### Requested by

${id}
`,
  });

  it("keeps only the newest Feature Issue of each request", () => {
    const kept = newestPerRequest([
      issue(801, ID),
      issue(811, ID),
      issue(802, OTHER),
      issue(805, ID),
    ]);

    expect(kept.map((each) => each.number).sort()).toEqual([802, 811]);
  });

  it("keeps a request's only Issue", () => {
    expect(
      newestPerRequest([issue(801, ID)]).map((each) => each.number),
    ).toEqual([801]);
  });
});
