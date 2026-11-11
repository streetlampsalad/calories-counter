import { describe, expect, it, vi } from "vitest";
import {
  deliveredBy,
  fieldsFromLabels,
  issuesToClose,
  parentIsFinished,
  parseRefs,
  pullRefs,
  STATUS,
  statusFor,
} from "./board.mjs";

const issue = (overrides = {}) => ({
  state: "OPEN",
  labels: [],
  assigned: false,
  pulls: [],
  subIssues: [],
  ...overrides,
});
const pull = (overrides = {}) => ({
  state: "OPEN",
  merged: false,
  isDraft: false,
  ...overrides,
});

describe("parseRefs", () => {
  it("finds Refs and closing keywords", () => {
    expect(
      parseRefs("Refs #12\nFixes #3, #4 and #5\ncloses: #7\nSee #99"),
    ).toEqual([3, 4, 5, 7, 12]);
  });

  it("handles an empty body", () => {
    expect(parseRefs(null)).toEqual([]);
  });
});

describe("pullRefs", () => {
  it("reads Refs in a pull request's title as well as its body (#197)", () => {
    expect(
      pullRefs({
        title: "Fix the meal heading (Refs #184)",
        body: "Fixes #12",
      }),
    ).toEqual([12, 184]);
  });

  it("counts a number in both the title and the body once", () => {
    expect(pullRefs({ title: "Thing (Refs #184)", body: "Refs #184" })).toEqual(
      [184],
    );
  });

  it("handles a pull request with no title or body", () => {
    expect(pullRefs({ title: null, body: null })).toEqual([]);
  });
});

describe("statusFor", () => {
  it("starts in Backlog", () => {
    expect(statusFor(issue())).toBe(STATUS.backlog);
  });

  it("is Ready once ready-for-agent", () => {
    expect(statusFor(issue({ labels: ["slice", "ready-for-agent"] }))).toBe(
      STATUS.ready,
    );
  });

  it("is In progress once claimed or with a draft pull request", () => {
    expect(
      statusFor(issue({ labels: ["ready-for-agent"], assigned: true })),
    ).toBe(STATUS.inProgress);
    expect(statusFor(issue({ pulls: [pull({ isDraft: true })] }))).toBe(
      STATUS.inProgress,
    );
  });

  it("is In review with an open pull request, and stays there until deployed", () => {
    expect(statusFor(issue({ assigned: true, pulls: [pull()] }))).toBe(
      STATUS.inReview,
    );
    expect(
      statusFor(issue({ pulls: [pull({ state: "CLOSED", merged: true })] })),
    ).toBe(STATUS.inReview);
  });

  it("goes back to Ready when its pull request closes unmerged", () => {
    expect(
      statusFor(
        issue({
          labels: ["ready-for-agent"],
          pulls: [pull({ state: "CLOSED" })],
        }),
      ),
    ).toBe(STATUS.ready);
  });

  it("is Done when closed", () => {
    expect(statusFor(issue({ state: "CLOSED", pulls: [pull()] }))).toBe(
      STATUS.done,
    );
  });

  it("keeps a Spec In progress after its Spec pull request merges", () => {
    expect(
      statusFor(
        issue({
          labels: ["spec"],
          pulls: [pull({ state: "CLOSED", merged: true })],
        }),
      ),
    ).toBe(STATUS.inProgress);
    expect(
      statusFor(
        issue({
          labels: ["spec"],
          subIssues: [{ state: "OPEN", assigned: true }],
        }),
      ),
    ).toBe(STATUS.inProgress);
  });
});

describe("a Feature with its Spec as a sub-issue", () => {
  it("is In progress, not In review, once its Spec starts", () => {
    expect(
      statusFor(
        issue({
          labels: ["feature"],
          subIssues: [{ state: "OPEN", assigned: true }],
        }),
      ),
    ).toBe(STATUS.inProgress);
  });
});

describe("fieldsFromLabels", () => {
  it("mirrors priority and size labels", () => {
    expect(fieldsFromLabels(["bug", "priority:P0", "size:XS"])).toEqual({
      Priority: "P0",
      Size: "XS",
    });
  });
});

describe("parentIsFinished", () => {
  it("needs at least one Slice, all closed", () => {
    expect(parentIsFinished([])).toBe(false);
    expect(parentIsFinished([{ state: "CLOSED" }, { state: "OPEN" }])).toBe(
      false,
    );
    expect(parentIsFinished([{ state: "CLOSED" }])).toBe(true);
  });
});

describe("issuesToClose", () => {
  // An open Issue as close-deployed.mjs reads it; a closed or missing Issue is null.
  const open = (overrides = {}) => ({
    labels: [],
    subIssues: 0,
    isPullRequest: false,
    deliveredBy: [],
    ...overrides,
  });
  const lookup = (issues) => (number) => issues[number] ?? null;

  it("closes the open Issue of every deployed pull request, whatever deployed before (#156)", () => {
    const pulls = [
      { number: 155, body: "Refs #153" },
      { number: 152, body: "Refs #151" },
    ];
    expect(
      issuesToClose(pulls, lookup({ 153: open(), 151: open() }), () => true),
    ).toEqual([
      { issue: 153, pull: 155 },
      { issue: 151, pull: 152 },
    ]);
  });

  it("leaves an Issue open while its pull request is not in the deployed commit", () => {
    const pulls = [
      { number: 160, body: "Refs #159" },
      { number: 155, body: "Refs #153" },
    ];
    const deployed = new Set([155]);
    expect(
      issuesToClose(pulls, lookup({ 159: open(), 153: open() }), (pull) =>
        deployed.has(pull.number),
      ),
    ).toEqual([{ issue: 153, pull: 155 }]);
  });

  it("skips closed Issues, Specs, parents and pull requests, which close another way", () => {
    const pulls = [{ number: 149, body: "Refs #147, #146, #120, #148, #145" }];
    expect(
      issuesToClose(
        pulls,
        lookup({
          147: open({ labels: ["spec"] }),
          146: open({ subIssues: 1 }),
          148: open(),
          145: open({ isPullRequest: true }),
        }),
        () => true,
      ),
    ).toEqual([{ issue: 148, pull: 149 }]);
  });

  it("asks whether a pull request is deployed only when it has an Issue left to close", () => {
    const isDeployed = vi.fn(() => true);
    issuesToClose(
      [
        { number: 144, body: "Refs #140" },
        { number: 143, body: "Refs #139" },
        { number: 137, body: "No Issue" },
      ],
      lookup({ 139: open() }),
      isDeployed,
    );
    expect(isDeployed.mock.calls.map(([pull]) => pull.number)).toEqual([143]);
  });

  it("goes by the newest pull request for an Issue, so an older one never closes it early", () => {
    const pulls = [
      { number: 165, body: "Refs #158" },
      { number: 160, body: "Refs #158" },
    ];
    expect(
      issuesToClose(
        pulls,
        lookup({ 158: open() }),
        (pull) => pull.number === 160,
      ),
    ).toEqual([]);
    expect(issuesToClose(pulls, lookup({ 158: open() }), () => true)).toEqual([
      { issue: 158, pull: 165 },
    ]);
  });

  it("closes the Issue named only in a pull request's title (#197)", () => {
    expect(
      issuesToClose(
        [
          {
            number: 185,
            title: "Smaller meal headings (Refs #184)",
            body: "Smaller meal headings",
          },
        ],
        lookup({ 184: open() }),
        () => true,
      ),
    ).toEqual([{ issue: 184, pull: 185 }]);
  });

  it("closes an Issue in both the title and the body once", () => {
    expect(
      issuesToClose(
        [
          {
            number: 185,
            title: "Smaller meal headings (Refs #184)",
            body: "Refs #184",
          },
        ],
        lookup({ 184: open() }),
        () => true,
      ),
    ).toEqual([{ issue: 184, pull: 185 }]);
  });

  it("does not close a reopened Issue again for a pull request that already delivered it", () => {
    expect(
      issuesToClose(
        [{ number: 160, body: "Refs #158" }],
        lookup({ 158: open({ deliveredBy: [160] }) }),
        () => true,
      ),
    ).toEqual([]);
  });
});

describe("deliveredBy", () => {
  it("reads the pull requests a deploy closed the Issue for, from its comments", () => {
    expect(
      deliveredBy([
        { body: "In production since 433bfc6 (#123)." },
        { body: "In production as of d20dfd7 (#155)." },
        { body: "Claimed by /deliver" },
        { body: "Is this in production as of d20dfd7 (#99)? No." },
      ]),
    ).toEqual([123, 155]);
  });
});
