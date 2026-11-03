import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string, args: unknown) => rpc(name, args),
  }),
}));

import { useImportFoods } from "./queries";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

const rows = [
  { name: "Banana", portion: "1 medium", calories: 105 },
  { id: "food-1", name: "Toast", portion: "1 slice", calories: 120 },
];

describe("useImportFoods", () => {
  beforeEach(() => rpc.mockReset());

  it("sends every row in one call and returns the counts", async () => {
    rpc.mockResolvedValue({ data: [{ added: 1, updated: 1 }], error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useImportFoods(), { wrapper });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync(rows);
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("import_foods", { rows });
    expect(outcome).toEqual({ added: 1, updated: 1 });
  });

  it("refreshes Foods and everything built from their calories afterwards", async () => {
    rpc.mockResolvedValue({ data: [{ added: 1, updated: 1 }], error: null });
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useImportFoods(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(rows);
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["foods"]);
    expect(keys).toContainEqual(["entries"]);
    expect(keys).toContainEqual(["summary"]);
  });

  it("fails in plain words, and leaves the caches alone", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useImportFoods(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(rows).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/already in your list/);
    expect(result.current.error?.message).toMatch(/Nothing was saved/);
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("useImportFoods: other failures", () => {
  beforeEach(() => rpc.mockReset());

  it.each([
    ["23514", /isn't allowed/],
    ["P0002", /no longer in your list/],
    ["XX000", /Couldn't save: boom/],
  ])("explains %s", async (code, expected) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "boom" } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useImportFoods(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(rows).catch(() => undefined);
    });

    await waitFor(() =>
      expect(result.current.error?.message).toMatch(expected),
    );
  });
});
