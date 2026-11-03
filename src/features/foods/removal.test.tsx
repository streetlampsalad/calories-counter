import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteSelect = vi.fn();
const updateSelect = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      delete: () => ({
        eq: (_c: string, id: string) => ({ select: () => deleteSelect(id) }),
      }),
      update: (patch: unknown) => ({
        eq: (_c: string, id: string) => ({
          select: () => updateSelect(patch, id),
        }),
      }),
    }),
  }),
}));

import { foodKeys, useRemoveFood, useRestoreFood } from "./queries";
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
const pie: Food = {
  id: "pie",
  name: "Pie",
  portion: "1 slice",
  calories: 300,
  archivedAt: "2026-11-01T00:00:00Z",
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  queryClient.setQueryData(foodKeys.list(), [rice, toast]);
  queryClient.setQueryData(foodKeys.archived(), [pie]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const live = (qc: QueryClient) => qc.getQueryData<Food[]>(foodKeys.list());
const archived = (qc: QueryClient) =>
  qc.getQueryData<Food[]>(foodKeys.archived());

describe("useRemoveFood", () => {
  beforeEach(() => {
    deleteSelect.mockReset();
    updateSelect.mockReset();
  });

  it("deletes a Food that has no Entries", async () => {
    deleteSelect.mockResolvedValue({ data: [{ id: "toast" }], error: null });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRemoveFood(), { wrapper });

    act(() => result.current.mutate({ food: toast, hasEntries: false }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe("deleted");
    expect(deleteSelect).toHaveBeenCalledWith("toast");
    expect(updateSelect).not.toHaveBeenCalled();
    expect(live(queryClient)).toEqual([rice]);
  });

  it("archives a Food that has Entries, and never deletes it (ADR 0001)", async () => {
    updateSelect.mockResolvedValue({ data: [{ id: "toast" }], error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useRemoveFood(), { wrapper });

    act(() => result.current.mutate({ food: toast, hasEntries: true }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe("archived");
    expect(deleteSelect).not.toHaveBeenCalled();
    expect(updateSelect).toHaveBeenCalledWith(
      { archived_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
      "toast",
    );
  });

  it("archives instead when the database says Entries appeared since we looked", async () => {
    deleteSelect.mockResolvedValue({
      data: null,
      error: { code: "23503", message: "foreign key" },
    });
    updateSelect.mockResolvedValue({ data: [{ id: "toast" }], error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useRemoveFood(), { wrapper });

    act(() => result.current.mutate({ food: toast, hasEntries: false }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe("archived");
  });

  it("takes the Food off the list straight away, before the server answers", async () => {
    let finish: (value: unknown) => void = () => {};
    deleteSelect.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRemoveFood(), { wrapper });

    act(() => result.current.mutate({ food: toast, hasEntries: false }));

    await waitFor(() => expect(live(queryClient)).toEqual([rice]));
    finish({ data: [{ id: "toast" }], error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("puts the Food back when removing fails", async () => {
    deleteSelect.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "down" },
    });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRemoveFood(), { wrapper });

    act(() => result.current.mutate({ food: toast, hasEntries: false }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      "Couldn't remove Toast. Check your connection and try again.",
    );
    expect(live(queryClient)).toEqual([rice, toast]);
  });
});

describe("useRestoreFood", () => {
  beforeEach(() => updateSelect.mockReset());

  it("moves the Food from Archived back to the list", async () => {
    updateSelect.mockResolvedValue({ data: [{ id: "pie" }], error: null });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRestoreFood(), { wrapper });

    act(() => result.current.mutate(pie));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateSelect).toHaveBeenCalledWith({ archived_at: null }, "pie");
    expect(live(queryClient)?.map((f) => f.name)).toEqual([
      "Pie",
      "Rice",
      "Toast",
    ]);
    expect(
      live(queryClient)?.find((f) => f.id === "pie")?.archivedAt,
    ).toBeNull();
    expect(archived(queryClient)).toEqual([]);
  });

  it("explains a clash with a live Food of the same name and Portion, and changes nothing", async () => {
    updateSelect.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "dup" },
    });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRestoreFood(), { wrapper });

    act(() => result.current.mutate(pie));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      "You already have Pie (1 slice)",
    );
    expect(live(queryClient)).toEqual([rice, toast]);
    expect(archived(queryClient)).toEqual([pie]);
  });
});
