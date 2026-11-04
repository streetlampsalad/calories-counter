import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { summaryKeys } from "@/lib/query-keys";

const maybeSingle = vi.fn();
const selectEq = vi.fn();
const upsert = vi.fn();
const deleteEq = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      expect(table).toBe("calories_burned");
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            selectEq(column, value);
            return { maybeSingle: () => maybeSingle() };
          },
        }),
        upsert: (row: unknown, options: unknown) => upsert(row, options),
        delete: () => ({
          eq: (column: string, value: string) => deleteEq(column, value),
        }),
      };
    },
  }),
}));

import { burnedKeys, useDayBurned, useSetBurned } from "./queries";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useDayBurned", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    selectEq.mockReset();
  });

  it("reads the figure saved for the Day", async () => {
    maybeSingle.mockResolvedValue({ data: { calories: 2450 }, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useDayBurned("2026-11-02", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toBe(2450));
    expect(selectEq).toHaveBeenCalledWith("day", "2026-11-02");
  });

  it("is null for a Day with none", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useDayBurned("2026-11-02", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("asks nothing when the User does not track it (AC-2)", () => {
    const { wrapper } = setup();
    renderHook(() => useDayBurned("2026-11-02", false), { wrapper });

    expect(maybeSingle).not.toHaveBeenCalled();
  });
});

describe("useSetBurned", () => {
  beforeEach(() => {
    upsert.mockReset();
    deleteEq.mockReset();
  });

  const cached = (queryClient: QueryClient, day: string) =>
    queryClient.getQueryData(burnedKeys.day(day));

  it("shows the figure before the server answers (AC-4)", async () => {
    let finish: (value: unknown) => void = () => {};
    upsert.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(burnedKeys.day("2026-11-02"), null);
    const { result } = renderHook(() => useSetBurned(), { wrapper });

    act(() => result.current.mutate({ day: "2026-11-02", calories: 2450 }));

    await waitFor(() => expect(cached(queryClient, "2026-11-02")).toBe(2450));
    finish({ error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("saves one value per Day by replacing it (AC-4)", async () => {
    upsert.mockResolvedValue({ error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSetBurned(), { wrapper });

    act(() => result.current.mutate({ day: "2026-11-02", calories: 2600 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(upsert).toHaveBeenCalledWith(
      { day: "2026-11-02", calories: 2600 },
      { onConflict: "user_id,day" },
    );
  });

  it("clears a Day's figure with null (AC-4)", async () => {
    deleteEq.mockResolvedValue({ error: null });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(burnedKeys.day("2026-11-02"), 2450);
    const { result } = renderHook(() => useSetBurned(), { wrapper });

    act(() => result.current.mutate({ day: "2026-11-02", calories: null }));

    await waitFor(() => expect(cached(queryClient, "2026-11-02")).toBeNull());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteEq).toHaveBeenCalledWith("day", "2026-11-02");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("puts the old figure back when saving fails (AC-4)", async () => {
    upsert.mockResolvedValue({ error: { code: "08006", message: "down" } });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(burnedKeys.day("2026-11-02"), 2450);
    const { result } = renderHook(() => useSetBurned(), { wrapper });

    act(() => result.current.mutate({ day: "2026-11-02", calories: 3000 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Couldn't save that. Check your connection and try again.",
    );
    expect(cached(queryClient, "2026-11-02")).toBe(2450);
  });

  it("puts a cleared figure back when clearing fails", async () => {
    deleteEq.mockResolvedValue({ error: { message: "down" } });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(burnedKeys.day("2026-11-02"), 2450);
    const { result } = renderHook(() => useSetBurned(), { wrapper });

    act(() => result.current.mutate({ day: "2026-11-02", calories: null }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(queryClient, "2026-11-02")).toBe(2450);
  });

  it("refreshes the Summary, whose Deficit follows it", async () => {
    upsert.mockResolvedValue({ error: null });
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSetBurned(), { wrapper });

    act(() => result.current.mutate({ day: "2026-11-02", calories: 2450 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: summaryKeys.all });
  });
});
