import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: (name: string, args: unknown) => rpc(name, args),
  }),
}));

import { isToggleOn } from "./server";

describe("isToggleOn", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("asks the database about the Toggle's key", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    expect(await isToggleOn("feature-113")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("toggle_is_on", { key: "feature-113" });
  });

  it("is off when the database says off, including for a missing Toggle (US1.1)", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    expect(await isToggleOn("feature-999")).toBe(false);
  });

  it("is off when the database cannot answer, such as with no session (US1.9)", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    expect(await isToggleOn("feature-113")).toBe(false);
  });

  it("is off when the request itself fails (US1.9)", async () => {
    rpc.mockRejectedValue(new Error("fetch failed"));

    expect(await isToggleOn("feature-113")).toBe(false);
  });
});
