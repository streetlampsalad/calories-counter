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

import { useDailyTotals } from "./queries";

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
