import { describe, expect, it } from "vitest";
import { decideAccess } from "./route-access";

describe("decideAccess", () => {
  it("sends a signed-out User to sign-in, remembering where they were going", () => {
    expect(
      decideAccess({ pathname: "/foods", search: "?q=a", signedIn: false }),
    ).toEqual({
      action: "redirect",
      to: "/sign-in?next=%2Ffoods%3Fq%3Da",
    });
  });

  it("does not add next for the home page", () => {
    expect(
      decideAccess({ pathname: "/", search: "", signedIn: false }),
    ).toEqual({
      action: "redirect",
      to: "/sign-in?next=%2F",
    });
  });

  it.each([
    "/sign-in",
    "/auth/callback",
    "/api/health",
    "/api/reminders/send",
    "/manifest.webmanifest",
    "/sw.js",
    "/offline",
  ])("lets a signed-out User reach %s", (pathname) => {
    expect(decideAccess({ pathname, search: "", signedIn: false })).toEqual({
      action: "next",
    });
  });

  it("refuses a signed-out call to an API route instead of redirecting it", () => {
    expect(
      decideAccess({
        pathname: "/api/import/photo",
        search: "",
        signedIn: false,
      }),
    ).toEqual({ action: "unauthorized" });
  });

  it("lets a signed-in User call an API route", () => {
    expect(
      decideAccess({
        pathname: "/api/import/photo",
        search: "",
        signedIn: true,
      }),
    ).toEqual({ action: "next" });
  });

  it("sends a signed-in User away from sign-in", () => {
    expect(
      decideAccess({ pathname: "/sign-in", search: "", signedIn: true }),
    ).toEqual({
      action: "redirect",
      to: "/",
    });
  });

  it("lets a signed-in User through everywhere else", () => {
    expect(
      decideAccess({ pathname: "/foods", search: "", signedIn: true }),
    ).toEqual({
      action: "next",
    });
    expect(
      decideAccess({ pathname: "/api/health", search: "", signedIn: true }),
    ).toEqual({
      action: "next",
    });
  });

  it("does not treat lookalike paths as public", () => {
    expect(
      decideAccess({ pathname: "/sign-in-now", search: "", signedIn: false })
        .action,
    ).toBe("redirect");
  });
});
