import { describe, expect, it } from "vitest";
import { healthPayload } from "./health";

describe("healthPayload", () => {
  it("reports ok with the deployed commit", () => {
    expect(healthPayload({ COMMIT_SHA: "4f9c2ab" })).toEqual({
      status: "ok",
      commit: "4f9c2ab",
    });
  });

  it("reports an unknown commit when none was provided", () => {
    expect(healthPayload({})).toEqual({ status: "ok", commit: "unknown" });
  });

  it("treats an empty commit as unknown", () => {
    expect(healthPayload({ COMMIT_SHA: "" }).commit).toBe("unknown");
  });
});
