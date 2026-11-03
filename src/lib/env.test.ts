import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";

describe("parsePublicEnv", () => {
  it("returns the values when all are present", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("names every missing variable in the error", () => {
    expect(() => parsePublicEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });
});
