import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiUnavailable } from "./ai";
import {
  describeFailure,
  GEMINI_LIGHT_MODEL,
  GEMINI_MODEL,
  GEMINI_THINKING_LEVEL,
  geminiTransport,
  isUnavailable,
} from "./gemini";

const create = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create };
  },
}));

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

describe("the model's thinking level", () => {
  it("is one gemini-3.8-flash supports: low, medium or high, never minimal", () => {
    expect(GEMINI_MODEL).toBe("gemini-3.8-flash");
    expect(["low", "medium", "high"]).toContain(GEMINI_THINKING_LEVEL);
  });
});

describe("geminiTransport", () => {
  const request = {
    system: "s",
    input: [{ type: "text" as const, text: "t" }],
    schema: {},
  };
  const overloaded = new Failure("503 high demand", 503);

  beforeEach(() => {
    create.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("uses the main model unless asked for another", async () => {
    create.mockResolvedValue({ output_text: "{}" });

    await geminiTransport("k")(request);
    await geminiTransport("k", { model: GEMINI_LIGHT_MODEL })(request);

    expect(create.mock.calls[0][0].model).toBe(GEMINI_MODEL);
    expect(create.mock.calls[1][0].model).toBe("gemini-3.5-flash-lite");
  });

  it("tries once more when Google is overloaded, and returns the second answer", async () => {
    create
      .mockRejectedValueOnce(overloaded)
      .mockResolvedValueOnce({ output_text: '{"ok":true}' });

    const text = await geminiTransport("k", { retryDelayMs: 0 })(request);

    expect(text).toBe('{"ok":true}');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("gives up as unavailable if the second try is overloaded too", async () => {
    create.mockRejectedValue(overloaded);

    await expect(
      geminiTransport("k", { retryDelayMs: 0 })(request),
    ).rejects.toBeInstanceOf(AiUnavailable);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("does not retry quota, timeouts or our own mistakes", async () => {
    for (const failure of [
      new Failure("quota", 429),
      new Failure("Request timed out", undefined, "TimeoutError"),
      new Failure("bad request", 400),
    ]) {
      create.mockReset();
      create.mockRejectedValue(failure);

      await expect(
        geminiTransport("k", { retryDelayMs: 0 })(request),
      ).rejects.toBeDefined();
      expect(create).toHaveBeenCalledTimes(1);
    }
  });
});
