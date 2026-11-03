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
  beforeEach(() => exchangeCodeForSession.mockReset());

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
});
