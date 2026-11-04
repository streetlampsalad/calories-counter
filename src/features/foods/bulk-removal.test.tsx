import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const insert = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string, args: unknown) => rpc(name, args),
    from: () => ({ insert: (rows: unknown) => insert(rows) }),
  }),
}));

import { foodKeys, useRemoveFoods, useRestoreFoods } from "./queries";
import type { Food } from "./types";

const food = (id: string, name: string, calories: number): Food => ({
  id,
  name,
  portion: "1 serve",
  calories,
  archivedAt: null,
});
const apple = food("apple", "Apple", 80);
const bread = food("bread", "Bread", 120);
const cheese = food("cheese", "Cheese", 200);

function setup(list: Food[] = [apple, bread, cheese]) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  queryClient.setQueryData(foodKeys.list(), list);
  queryClient.setQueryData(foodKeys.archived(), [
    { ...bread, archivedAt: "2026-11-01T00:00:00Z" },
  ]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}
const live = (qc: QueryClient) =>
  qc.getQueryData<Food[]>(foodKeys.list())?.map((f) => f.id);

describe("useRemoveFoods", () => {
  beforeEach(() => rpc.mockReset());

  it("takes every Food off the list straight away, before the server answers", async () => {
    let finish: (value: unknown) => void = () => {};
    rpc.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRemoveFoods(), { wrapper });

    act(() => result.current.mutate([apple, bread]));

    await waitFor(() => expect(live(queryClient)).toEqual(["cheese"]));
    finish({ data: [], error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("makes one request for all of them", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useRemoveFoods(), { wrapper });

    act(() => result.current.mutate([apple, bread]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("remove_foods", {
      ids: ["apple", "bread"],
    });
  });

  it("reports which Foods the server archived and which it deleted", async () => {
    rpc.mockResolvedValue({
      data: [
        { food_id: "apple", outcome: "deleted" },
        { food_id: "bread", outcome: "archived" },
      ],
      error: null,
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useRemoveFoods(), { wrapper });

    act(() => result.current.mutate([apple, bread]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      archived: [bread],
      deleted: [apple],
    });
  });

  it("brings every Food back when the server refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRemoveFoods(), { wrapper });

    act(() => result.current.mutate([apple, bread]));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Couldn't remove those foods. Check your connection and try again.",
    );
    expect(live(queryClient)).toEqual(["apple", "bread", "cheese"]);
  });

  it("refreshes every Foods cache once done", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemoveFoods(), { wrapper });

    act(() => result.current.mutate([apple]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: foodKeys.all });
  });
});

describe("useRestoreFoods", () => {
  beforeEach(() => {
    rpc.mockReset();
    insert.mockReset();
  });

  it("restores the Archived Foods and re-creates the deleted ones with their own ids", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    insert.mockResolvedValue({ error: null });
    const { wrapper } = setup([cheese]);
    const { result } = renderHook(() => useRestoreFoods(), { wrapper });

    act(() => result.current.mutate({ archived: [bread], deleted: [apple] }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledWith("restore_foods", { ids: ["bread"] });
    expect(insert).toHaveBeenCalledWith([
      { id: "apple", name: "Apple", portion: "1 serve", calories: 80 },
    ]);
  });

  it("puts them all in the list straight away, in order, and out of Archived foods", async () => {
    rpc.mockReturnValue(new Promise(() => {}));
    insert.mockReturnValue(new Promise(() => {}));
    const { queryClient, wrapper } = setup([cheese]);
    const { result } = renderHook(() => useRestoreFoods(), { wrapper });

    act(() => result.current.mutate({ archived: [bread], deleted: [apple] }));

    await waitFor(() =>
      expect(live(queryClient)).toEqual(["apple", "bread", "cheese"]),
    );
    expect(queryClient.getQueryData(foodKeys.archived())).toEqual([]);
  });

  it("asks for nothing it does not need", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    insert.mockResolvedValue({ error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useRestoreFoods(), { wrapper });

    act(() => result.current.mutate({ archived: [], deleted: [apple] }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).not.toHaveBeenCalled();

    act(() => result.current.mutate({ archived: [bread], deleted: [] }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("says so when a name and Portion has since been taken, and undoes the list", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    const { queryClient, wrapper } = setup([cheese]);
    const { result } = renderHook(() => useRestoreFoods(), { wrapper });

    act(() => result.current.mutate({ archived: [bread], deleted: [] }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "You already have a food with the same name and portion.",
    );
    expect(live(queryClient)).toEqual(["cheese"]);
  });

  it("fails kindly when the connection is down", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    insert.mockResolvedValue({ error: { code: "08006" } });
    const { wrapper } = setup([cheese]);
    const { result } = renderHook(() => useRestoreFoods(), { wrapper });

    act(() => result.current.mutate({ archived: [], deleted: [apple] }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Couldn't bring those foods back. Check your connection and try again.",
    );
  });
});
