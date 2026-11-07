import { describe, expect, it } from "vitest";
import {
  fieldsFromLabels,
  parentIsFinished,
  parseRefs,
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
