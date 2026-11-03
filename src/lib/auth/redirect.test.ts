import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./redirect";

describe("sanitizeNext", () => {
  it("keeps a same-site path with its query", () => {
    expect(sanitizeNext("/foods?q=toast")).toBe("/foods?q=toast");
  });

  it("falls back to the home page when missing", () => {
    expect(sanitizeNext(null)).toBe("/");
    expect(sanitizeNext(undefined)).toBe("/");
    expect(sanitizeNext("")).toBe("/");
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "http://evil.com/path",
    "/\\evil.com",
    "javascript:alert(1)",
    "evil.com",
  ])("rejects %s, so sign-in can never be an open redirect", (value) => {
    expect(sanitizeNext(value)).toBe("/");
  });

  it("never sends a signed-in User back to the sign-in page", () => {
    expect(sanitizeNext("/sign-in")).toBe("/");
    expect(sanitizeNext("/sign-in?error=x")).toBe("/");
  });
});
