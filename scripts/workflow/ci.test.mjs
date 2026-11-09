import { describe, expect, it } from "vitest";
import { reusablePullRequestRun, testedTreeName } from "./ci.mjs";

const REPO = "streetlampsalad/calories-counter";
const TREE = "a1b2c3";
const pull = (overrides = {}) => ({
  merged_at: "2026-11-09T01:00:00Z",
  head: { repo: { full_name: REPO } },
  ...overrides,
});
const run = (id, created_at, overrides = {}) => ({
  id,
  created_at,
  status: "completed",
  conclusion: "success",
  ...overrides,
});

describe("reusablePullRequestRun", () => {
  it("picks the pull request's newest CI run when it passed", () => {
    expect(
      reusablePullRequestRun(
        pull(),
        [run(1, "2026-11-09T00:40:00Z"), run(2, "2026-11-09T00:50:00Z")],
        REPO,
      ),
    ).toBe(2);
  });

  it("reuses nothing when the newest run did not pass, even if an older one did", () => {
    expect(
      reusablePullRequestRun(
        pull(),
        [
          run(1, "2026-11-09T00:40:00Z"),
          run(2, "2026-11-09T00:50:00Z", { conclusion: "failure" }),
        ],
        REPO,
      ),
    ).toBeNull();
    expect(
      reusablePullRequestRun(
        pull(),
        [
          run(3, "2026-11-09T00:55:00Z", {
            status: "in_progress",
            conclusion: null,
          }),
        ],
        REPO,
      ),
    ).toBeNull();
  });

  it("reuses nothing for a pull request from a fork, or one that was not merged", () => {
    expect(
      reusablePullRequestRun(
        pull({ head: { repo: { full_name: "someone/calories-counter" } } }),
        [run(1, "2026-11-09T00:40:00Z")],
        REPO,
      ),
    ).toBeNull();
    expect(
      reusablePullRequestRun(
        pull({ merged_at: null }),
        [run(1, "2026-11-09T00:40:00Z")],
        REPO,
      ),
    ).toBeNull();
    expect(reusablePullRequestRun(pull(), [], REPO)).toBeNull();
  });
});

describe("testedTreeName", () => {
  it("names the artifact a pull request's CI records for the tree it tested", () => {
    expect(testedTreeName(TREE)).toBe("tested-tree-a1b2c3");
  });
});
