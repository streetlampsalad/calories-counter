import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "./route";

const call = (query: string) =>
  GET(new Request(`https://app.test/auth/callback${query}`));
const location = (response: Response) =>
  new URL(response.headers.get("location") ?? "");

describe("GET /auth/callback", () => {
  const log = vi.spyOn(console, "error");
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    log.mockReset();
    log.mockImplementation(() => undefined);
  });

  it("exchanges the code and sends the User to where they were going", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await call("?code=abc&next=%2Ffoods");

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(location(response).href).toBe("https://app.test/foods");
  });

  it("ignores an off-site next, so it cannot be used as an open redirect", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await call("?code=abc&next=%2F%2Fevil.com");

    expect(location(response).href).toBe("https://app.test/");
  });

  it("returns to sign-in when the code cannot be exchanged", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });

    const response = await call("?code=abc");

    expect(location(response).pathname).toBe("/sign-in");
    expect(location(response).searchParams.get("error")).toBe("auth_failed");
  });

  it("returns to sign-in when there is no code", async () => {
    const response = await call("");

    expect(location(response).searchParams.get("error")).toBe("auth_failed");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("reports the invite-only rejection with the email that was refused", async () => {
    const response = await call(
      `?error=server_error&error_description=${encodeURIComponent(
        "This app is invite-only. Ask the owner to add stranger@gmail.com.",
      )}`,
    );

    expect(location(response).pathname).toBe("/sign-in");
    expect(location(response).searchParams.get("error")).toBe("not_allowed");
    expect(location(response).searchParams.get("email")).toBe(
      "stranger@gmail.com",
    );
  });

  it("does not echo arbitrary provider error text", async () => {
    const response = await call(
      `?error=access_denied&error_description=${encodeURIComponent("<script>alert(1)</script>")}`,
    );

    expect(location(response).searchParams.get("error")).toBe("auth_failed");
    expect(location(response).search).not.toContain("script");
  });

  it("logs why a code could not be exchanged, without the code itself", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: Object.assign(new Error("PKCE code verifier not found"), {
        name: "AuthPKCECodeVerifierMissingError",
        status: 400,
      }),
    });

    await call("?code=secret-code");

    const line = String(log.mock.calls[0][0]);
    expect(line).toContain("AuthPKCECodeVerifierMissingError (400)");
    expect(line).toContain("PKCE code verifier not found");
    expect(line).not.toContain("secret-code");
  });

  it("logs the provider's error code when sign-in comes back with an error", async () => {
    await call(
      "?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user",
    );

    const line = String(log.mock.calls[0][0]);
    expect(line).toContain("unexpected_failure");
    expect(line).toContain("Database error saving new user");
  });

  it("logs when sign-in comes back with no code", async () => {
    await call("");

    expect(String(log.mock.calls[0][0])).toContain("no code");
  });
});
