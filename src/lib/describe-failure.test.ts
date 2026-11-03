import { describe, expect, it } from "vitest";
import { describeFailure } from "./describe-failure";

class Failure extends Error {
  constructor(
    message: string,
    readonly status?: number,
    name = "Error",
  ) {
    super(message);
    this.name = name;
  }
}

describe("describeFailure", () => {
  it("says the kind, the status and why, so a log shows what Google refused", () => {
    expect(
      describeFailure(
        new Failure("Invalid JSON payload", 400, "BadRequestError"),
      ),
    ).toBe("BadRequestError (400): Invalid JSON payload");
  });

  it("copes with errors that have no status or message", () => {
    expect(describeFailure(new Failure("boom"))).toBe("Error: boom");
    expect(describeFailure("nope")).toBe("unknown error");
  });

  it("cuts a long message", () => {
    expect(describeFailure(new Failure("x".repeat(1000), 400)).length).toBe(
      "Error (400): ".length + 300,
    );
  });
});
