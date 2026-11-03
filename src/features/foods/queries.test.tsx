import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { entryKeys, summaryKeys } from "@/lib/query-keys";

const insert = vi.fn();
const updateSelect = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: (row: unknown) => insert(row),
      update: (patch: unknown) => ({
        eq: (_c: string, id: string) => ({
          select: () => updateSelect(patch, id),
        }),
      }),
    }),
  }),
}));

import { foodKeys, useAddFood, useUpdateFood } from "./queries";
import type { Food } from "./types";

const toast: Food = {
  id: "toast",
  name: "Toast",
  portion: "1 slice",
  calories: 110,
  archivedAt: null,
};
const rice: Food = {
  id: "rice",
  name: "Rice",
  portion: "100 g",
  calories: 130,
  archivedAt: null,
};

function setup(foods: Food[] = [toast, rice]) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  queryClient.setQueryData(foodKeys.list(), foods);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const cached = (queryClient: QueryClient) =>
  queryClient.getQueryData<Food[]>(foodKeys.list());

describe("useUpdateFood", () => {
  beforeEach(() => {
    insert.mockReset();
    updateSelect.mockReset();
  });

  it("changes the list straight away, before the server answers", async () => {
    let finish: (value: unknown) => void = () => {};
    updateSelect.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUpdateFood(), { wrapper });

    act(() => result.current.mutate({ ...toast, calories: 150 }));

    await waitFor(() =>
      expect(cached(queryClient)?.find((f) => f.id === "toast")?.calories).toBe(
        150,
      ),
    );
    expect(result.current.isPending).toBe(true);
    finish({ data: [{ id: "toast" }], error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("keeps the list sorted when a rename moves a Food", async () => {
    updateSelect.mockResolvedValue({ data: [{ id: "toast" }], error: null });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUpdateFood(), { wrapper });

    act(() => result.current.mutate({ ...toast, name: "Zucchini slice" }));

    await waitFor(() =>
      expect(cached(queryClient)?.map((f) => f.name)).toEqual([
        "Rice",
        "Zucchini slice",
      ]),
    );
  });

  it("puts everything back when the save fails", async () => {
    updateSelect.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "down" },
    });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUpdateFood(), { wrapper });

    act(() => result.current.mutate({ ...toast, calories: 999 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Couldn't save Toast. Check your connection and try again.",
    );
    expect(cached(queryClient)).toEqual([toast, rice]);
  });

  it("names the clash when another Food already has that name and Portion", async () => {
    updateSelect.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "dup" },
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateFood(), { wrapper });

    act(() =>
      result.current.mutate({ ...toast, name: "Rice", portion: "100 g" }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("You already have Rice (100 g)");
  });

  it("treats an update that touched no row as a failure", async () => {
    updateSelect.mockResolvedValue({ data: [], error: null });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUpdateFood(), { wrapper });

    act(() => result.current.mutate({ ...toast, calories: 1 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(queryClient)).toEqual([toast, rice]);
  });

  it("refreshes everything derived from a Food's Calories once saved (ADR 0001)", async () => {
    updateSelect.mockResolvedValue({ data: [{ id: "toast" }], error: null });
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateFood(), { wrapper });

    act(() => result.current.mutate({ ...toast, calories: 150 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(foodKeys.all);
    expect(keys).toContainEqual(entryKeys.all);
    expect(keys).toContainEqual(summaryKeys.all);
  });
});

describe("useAddFood", () => {
  beforeEach(() => insert.mockReset());

  it("adds the Food to the list straight away and removes it again if saving fails", async () => {
    insert.mockResolvedValue({ error: { code: "08006", message: "down" } });
    const { queryClient, wrapper } = setup([rice]);
    const { result } = renderHook(() => useAddFood(), { wrapper });

    act(() => result.current.mutate(toast));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(queryClient)).toEqual([rice]);
  });

  it("sends the id made on the device, so the saved row matches the optimistic one", async () => {
    insert.mockResolvedValue({ error: null });
    const { wrapper } = setup([]);
    const { result } = renderHook(() => useAddFood(), { wrapper });

    act(() => result.current.mutate(toast));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(insert).toHaveBeenCalledWith({
      id: "toast",
      name: "Toast",
      portion: "1 slice",
      calories: 110,
    });
  });
});
