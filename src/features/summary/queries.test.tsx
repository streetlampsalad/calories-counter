import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string, args: unknown) => rpc(name, args),
  }),
}));

import { useDailyTotals, usePeriodDays } from "./queries";

function setup() {
  const queryClient = new QueryClient({
    // The same freshness window as the app's own client, so switching back is served from cache.
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useDailyTotals", () => {
  beforeEach(() => rpc.mockReset());

  it("fetches a whole Period in a single call", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { wrapper } = setup();

    renderHook(() => useDailyTotals({ from: "2026-10-26", to: "2026-11-01" }), {
      wrapper,
    });

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("daily_totals", {
      range_from: "2026-10-26",
      range_to: "2026-11-01",
    });
  });

  it("turns the rows into Day totals, with counts as numbers", async () => {
    rpc.mockResolvedValue({
      data: [
        { day: "2026-10-26", calories: 2000, entry_count: 3 },
        { day: "2026-10-27", calories: 0, entry_count: "2" },
      ],
      error: null,
    });
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useDailyTotals({ from: "2026-10-26", to: "2026-11-01" }),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { day: "2026-10-26", calories: 2000, entryCount: 3 },
      { day: "2026-10-27", calories: 0, entryCount: 2 },
    ]);
  });

  it("keeps each Period's totals separately, so switching back is instant", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ from, to }) => useDailyTotals({ from, to }),
      { wrapper, initialProps: { from: "2026-10-26", to: "2026-11-01" } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ from: "2026-11-02", to: "2026-11-03" });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    rerender({ from: "2026-10-26", to: "2026-11-01" });

    expect(result.current.data).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("reports a failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useDailyTotals({ from: "2026-10-26", to: "2026-11-01" }),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("usePeriodDays", () => {
  beforeEach(() => rpc.mockReset());

  it("fetches a whole Period's totals and Calories Burned in a single call (AC-7)", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { wrapper } = setup();

    renderHook(() => usePeriodDays({ from: "2026-11-01", to: "2026-11-04" }), {
      wrapper,
    });

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("period_days", {
      range_from: "2026-11-01",
      range_to: "2026-11-04",
    });
  });

  it("keeps a missing figure null, never zero, with counts as numbers", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          day: "2026-11-01",
          calories: 2000,
          entry_count: "3",
          calories_burned: 2450,
        },
        {
          day: "2026-11-02",
          calories: 1500,
          entry_count: 2,
          calories_burned: null,
        },
        {
          day: "2026-11-03",
          calories: null,
          entry_count: 0,
          calories_burned: 2300,
        },
      ],
      error: null,
    });
    const { wrapper } = setup();
    const { result } = renderHook(
      () => usePeriodDays({ from: "2026-11-01", to: "2026-11-04" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      {
        day: "2026-11-01",
        calories: 2000,
        entryCount: 3,
        caloriesBurned: 2450,
      },
      {
        day: "2026-11-02",
        calories: 1500,
        entryCount: 2,
        caloriesBurned: null,
      },
      {
        day: "2026-11-03",
        calories: null,
        entryCount: 0,
        caloriesBurned: 2300,
      },
    ]);
  });

  it("is cached apart from the plain daily totals for the same range", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { queryClient, wrapper } = setup();
    const range = { from: "2026-11-01", to: "2026-11-04" };
    const totals = renderHook(() => useDailyTotals(range), { wrapper });
    await waitFor(() => expect(totals.result.current.isSuccess).toBe(true));

    renderHook(() => usePeriodDays(range), { wrapper });

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(queryClient.getQueryCache().getAll()).toHaveLength(2);
  });

  it("reports a failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    const { wrapper } = setup();
    const { result } = renderHook(
      () => usePeriodDays({ from: "2026-11-01", to: "2026-11-04" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
