import { describe, expect, it } from "vitest";
import { AiUnavailable } from "./ai";
import { describeFailure, isUnavailable } from "./gemini";

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

describe("isUnavailable", () => {
  it("is true for quota and service trouble", () => {
    expect(isUnavailable(new Failure("x", 429))).toBe(true);
    expect(isUnavailable(new Failure("x", 503))).toBe(true);
    expect(isUnavailable(new Failure("x", 500))).toBe(true);
    expect(isUnavailable(new Failure("got 429 Too Many Requests"))).toBe(true);
    expect(
      isUnavailable(new Failure("RESOURCE_EXHAUSTED: quota exceeded")),
    ).toBe(true);
    expect(isUnavailable(new Failure("The model is overloaded"))).toBe(true);
    expect(isUnavailable(new AiUnavailable("quota"))).toBe(true);
  });

  it("is true for timeouts and connection failures", () => {
    expect(
      isUnavailable(new Failure("x", undefined, "RequestTimeoutError")),
    ).toBe(true);
    expect(isUnavailable(new Failure("x", undefined, "ConnectionError"))).toBe(
      true,
    );
    expect(
      isUnavailable(new Failure("x", undefined, "RequestAbortedError")),
    ).toBe(true);
  });

  it("looks at the cause too", () => {
    expect(
      isUnavailable(new Error("failed", { cause: new Failure("x", 503) })),
    ).toBe(true);
  });

  it("is false for a mistake of ours, so it is seen rather than hidden", () => {
    expect(isUnavailable(new Failure("bad request", 400))).toBe(false);
    expect(
      isUnavailable(
        new Failure("Invalid argument", 400, "InvalidRequestError"),
      ),
    ).toBe(false);
    expect(isUnavailable(new TypeError("undefined is not a function"))).toBe(
      false,
    );
    expect(isUnavailable(null)).toBe(false);
    expect(isUnavailable("nope")).toBe(false);
  });
});

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
