import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { entryKeys, summaryKeys } from "@/lib/query-keys";

const insert = vi.fn();
const deleteEq = vi.fn();
const updateSelect = vi.fn();
const deleteIn = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: (row: unknown) => insert(row),
      delete: () => ({
        eq: (_c: string, id: string) => deleteEq(id),
        in: (_c: string, ids: string[]) => deleteIn(ids),
      }),
      update: (patch: unknown) => ({
        eq: (_c: string, id: string) => ({
          select: () => updateSelect(patch, id),
        }),
      }),
    }),
  }),
}));

import {
  useAddEntries,
  useAddEntry,
  useRemoveEntries,
  useRemoveEntry,
  useUpdateEntryQuantity,
} from "./queries";
import type { Entry } from "./types";

const DAY = "2026-11-03";
const toast: Entry = {
  id: "e1",
  day: DAY,
  quantity: 1.5,
  createdAt: "2026-11-03T08:00:00.000Z",
  food: { id: "toast", name: "Toast", portion: "1 slice", calories: 110 },
};
const rice: Entry = {
  id: "e2",
  day: DAY,
  quantity: 2,
  createdAt: "2026-11-03T07:00:00.000Z",
  food: { id: "rice", name: "Rice", portion: "100 g", calories: 130 },
};

function setup(entries: Entry[] = [rice]) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  queryClient.setQueryData(entryKeys.day(DAY), entries);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const cached = (queryClient: QueryClient) =>
  queryClient.getQueryData<Entry[]>(entryKeys.day(DAY));

describe("useAddEntry", () => {
  beforeEach(() => insert.mockReset());

  it("shows the Entry at the top straight away, before the server answers", async () => {
    let finish: (value: unknown) => void = () => {};
    insert.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useAddEntry(), { wrapper });

    act(() => result.current.mutate(toast));

    await waitFor(() =>
      expect(cached(queryClient)?.map((e) => e.id)).toEqual(["e1", "e2"]),
    );
    expect(result.current.isPending).toBe(true);
    finish({ error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("saves the id and time made on the device, so the saved row matches the shown one", async () => {
    insert.mockResolvedValue({ error: null });
    const { wrapper } = setup([]);
    const { result } = renderHook(() => useAddEntry(), { wrapper });

    act(() => result.current.mutate(toast));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(insert).toHaveBeenCalledWith({
      id: "e1",
      food_id: "toast",
      day: DAY,
      quantity: 1.5,
      created_at: "2026-11-03T08:00:00.000Z",
    });
  });

  it("takes the Entry back off when saving fails", async () => {
    insert.mockResolvedValue({ error: { code: "08006", message: "down" } });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useAddEntry(), { wrapper });

    act(() => result.current.mutate(toast));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Couldn't save that. Check your connection and try again.",
    );
    expect(cached(queryClient)).toEqual([rice]);
  });

  it("refreshes totals and Entry counts once saved", async () => {
    insert.mockResolvedValue({ error: null });
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAddEntry(), { wrapper });

    act(() => result.current.mutate(toast));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(entryKeys.day(DAY));
    expect(keys).toContainEqual(summaryKeys.all);
    expect(keys).toContainEqual(["foods", "entry-counts"]);
    expect(keys).toContainEqual(["foods", "usage"]);
  });

  it("starts a Day that has no cached list yet", async () => {
    insert.mockResolvedValue({ error: null });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAddEntry(), { wrapper });

    act(() => result.current.mutate(toast));

    await waitFor(() => expect(cached(queryClient)).toEqual([toast]));
  });
});

describe("useRemoveEntries", () => {
  beforeEach(() => deleteIn.mockReset());

  it("takes every Entry off the list straight away, before the server answers", async () => {
    let finish: (value: unknown) => void = () => {};
    deleteIn.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { queryClient, wrapper } = setup([toast, rice]);
    const { result } = renderHook(() => useRemoveEntries(), { wrapper });

    act(() => result.current.mutate([toast, rice]));

    await waitFor(() => expect(cached(queryClient)).toEqual([]));
    finish({ error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("leaves other Entries alone, and asks the server once for all of them", async () => {
    deleteIn.mockResolvedValue({ error: null });
    const keep: Entry = { ...rice, id: "e3" };
    const { queryClient, wrapper } = setup([toast, rice, keep]);
    const { result } = renderHook(() => useRemoveEntries(), { wrapper });

    act(() => result.current.mutate([toast, rice]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(cached(queryClient)?.map((e) => e.id)).toEqual(["e3"]);
    expect(deleteIn).toHaveBeenCalledTimes(1);
    expect(deleteIn).toHaveBeenCalledWith(["e1", "e2"]);
  });

  it("brings every Entry back when the server refuses", async () => {
    deleteIn.mockResolvedValue({ error: { code: "08006", message: "down" } });
    const { queryClient, wrapper } = setup([toast, rice]);
    const { result } = renderHook(() => useRemoveEntries(), { wrapper });

    act(() => result.current.mutate([toast, rice]));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Couldn't save that. Check your connection and try again.",
    );
    expect(cached(queryClient)).toEqual([toast, rice]);
  });

  it("refreshes totals and Entry counts once saved", async () => {
    deleteIn.mockResolvedValue({ error: null });
    const { queryClient, wrapper } = setup([toast, rice]);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemoveEntries(), { wrapper });

    act(() => result.current.mutate([toast, rice]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(entryKeys.day(DAY));
    expect(keys).toContainEqual(summaryKeys.all);
    expect(keys).toContainEqual(["foods", "entry-counts"]);
    expect(keys).toContainEqual(["foods", "usage"]);
  });
});

describe("useAddEntries", () => {
  beforeEach(() => insert.mockReset());

  it("puts the same Entries back in one request, with their own ids and times", async () => {
    insert.mockResolvedValue({ error: null });
    const { wrapper } = setup([]);
    const { result } = renderHook(() => useAddEntries(), { wrapper });

    act(() => result.current.mutate([toast, rice]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([
      {
        id: "e1",
        food_id: "toast",
        day: DAY,
        quantity: 1.5,
        created_at: "2026-11-03T08:00:00.000Z",
      },
      {
        id: "e2",
        food_id: "rice",
        day: DAY,
        quantity: 2,
        created_at: "2026-11-03T07:00:00.000Z",
      },
    ]);
  });

  it("shows them straight away, newest first among the others", async () => {
    insert.mockResolvedValue({ error: null });
    const newest: Entry = {
      ...toast,
      id: "e9",
      createdAt: "2026-11-03T09:00:00.000Z",
    };
    const { queryClient, wrapper } = setup([newest]);
    const { result } = renderHook(() => useAddEntries(), { wrapper });

    act(() => result.current.mutate([rice, toast]));

    await waitFor(() =>
      expect(cached(queryClient)?.map((e) => e.id)).toEqual(["e9", "e1", "e2"]),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("takes them all off again when saving fails", async () => {
    insert.mockResolvedValue({ error: { code: "08006", message: "down" } });
    const { queryClient, wrapper } = setup([]);
    const { result } = renderHook(() => useAddEntries(), { wrapper });

    act(() => result.current.mutate([toast, rice]));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(queryClient)).toEqual([]);
  });
});

describe("useRemoveEntry", () => {
  beforeEach(() => deleteEq.mockReset());

  it("takes the Entry off straight away", async () => {
    let finish: (value: unknown) => void = () => {};
    deleteEq.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { queryClient, wrapper } = setup([toast, rice]);
    const { result } = renderHook(() => useRemoveEntry(), { wrapper });

    act(() => result.current.mutate(toast));

    await waitFor(() =>
      expect(cached(queryClient)?.map((e) => e.id)).toEqual(["e2"]),
    );
    finish({ error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteEq).toHaveBeenCalledWith("e1");
  });

  it("puts the Entry back when removing fails", async () => {
    deleteEq.mockResolvedValue({ error: { code: "08006", message: "down" } });
    const { queryClient, wrapper } = setup([toast, rice]);
    const { result } = renderHook(() => useRemoveEntry(), { wrapper });

    act(() => result.current.mutate(toast));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(queryClient)).toEqual([toast, rice]);
  });
});

describe("useUpdateEntryQuantity", () => {
  beforeEach(() => updateSelect.mockReset());

  it("changes the Quantity straight away, keeping the Entry where it is", async () => {
    let finish: (value: unknown) => void = () => {};
    updateSelect.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { queryClient, wrapper } = setup([toast, rice]);
    const { result } = renderHook(() => useUpdateEntryQuantity(), { wrapper });

    act(() => result.current.mutate({ entry: toast, quantity: 3 }));

    await waitFor(() => expect(cached(queryClient)?.[0].quantity).toBe(3));
    expect(cached(queryClient)?.map((e) => e.id)).toEqual(["e1", "e2"]);
    finish({ data: [{ id: "e1" }], error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateSelect).toHaveBeenCalledWith({ quantity: 3 }, "e1");
  });

  it("puts the old Quantity back when saving fails", async () => {
    updateSelect.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "down" },
    });
    const { queryClient, wrapper } = setup([toast, rice]);
    const { result } = renderHook(() => useUpdateEntryQuantity(), { wrapper });

    act(() => result.current.mutate({ entry: toast, quantity: 3 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(queryClient)).toEqual([toast, rice]);
  });

  it("treats an update that touched no row as a failure", async () => {
    updateSelect.mockResolvedValue({ data: [], error: null });
    const { queryClient, wrapper } = setup([toast, rice]);
    const { result } = renderHook(() => useUpdateEntryQuantity(), { wrapper });

    act(() => result.current.mutate({ entry: toast, quantity: 3 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(queryClient)).toEqual([toast, rice]);
  });

  it("refreshes totals once saved", async () => {
    updateSelect.mockResolvedValue({ data: [{ id: "e1" }], error: null });
    const { queryClient, wrapper } = setup([toast, rice]);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateEntryQuantity(), { wrapper });

    act(() => result.current.mutate({ entry: toast, quantity: 3 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(entryKeys.day(DAY));
    expect(keys).toContainEqual(summaryKeys.all);
  });
});
