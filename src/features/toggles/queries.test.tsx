import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string) => rpc(name),
    from: (table: string) => {
      expect(table).toBe("toggle_overrides");
      return {
        upsert: (row: unknown, options: unknown) => upsert(row, options),
      };
    },
  }),
}));

import {
  type Toggle,
  toggleKeys,
  useSwitchToggle,
  useToggle,
  useToggles,
} from "./queries";

const rows = [
  {
    key: "feature-1",
    title: "In testing",
    state: "testing",
    is_on: true,
    can_switch: true,
  },
  {
    key: "feature-2",
    title: "Live for everyone",
    state: "live",
    is_on: true,
    can_switch: false,
  },
  {
    key: "feature-3",
    title: "Not tried",
    state: "testing",
    is_on: false,
    can_switch: true,
  },
];

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useToggles", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("loads every Toggle with the signed-in User's answer", async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useToggles(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith("my_toggles");
    expect(result.current.data?.[0]).toEqual({
      key: "feature-1",
      title: "In testing",
      state: "testing",
      isOn: true,
      canSwitch: true,
    });
  });
});

describe("useToggle", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("is off while Toggles are loading (US1.9)", () => {
    rpc.mockReturnValue(new Promise(() => {}));
    const { wrapper } = setup();
    const { result } = renderHook(() => useToggle("feature-1"), { wrapper });

    expect(result.current).toBe(false);
  });

  it("is off when loading fails (US1.9)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useToggle("feature-1"), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(toggleKeys.mine())?.status).toBe(
        "error",
      ),
    );
    expect(result.current).toBe(false);
  });

  it("is off for a key no Toggle has (US1.1)", async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useToggle("feature-999"), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(toggleKeys.mine())?.status).toBe(
        "success",
      ),
    );
    expect(result.current).toBe(false);
  });

  it("follows the database's answer once loaded", async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    const { wrapper } = setup();
    const on = renderHook(() => useToggle("feature-1"), { wrapper });
    const off = renderHook(() => useToggle("feature-3"), { wrapper });

    await waitFor(() => expect(on.result.current).toBe(true));
    expect(off.result.current).toBe(false);
  });
});

describe("useSwitchToggle", () => {
  beforeEach(() => {
    rpc.mockReset();
    upsert.mockReset();
  });

  function cached(queryClient: QueryClient, key: string) {
    return queryClient
      .getQueryData<Toggle[]>(toggleKeys.mine())
      ?.find((toggle) => toggle.key === key);
  }

  it("saves the User's choice and shows it at once", async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    let save: (value: { error: null }) => void = () => {};
    upsert.mockReturnValue(
      new Promise((resolve) => {
        save = resolve;
      }),
    );
    const { queryClient, wrapper } = setup();
    const toggles = renderHook(() => useToggles(), { wrapper });
    await waitFor(() => expect(toggles.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useSwitchToggle(), { wrapper });

    act(() => result.current.mutate({ key: "feature-3", on: true }));

    await waitFor(() =>
      expect(cached(queryClient, "feature-3")?.isOn).toBe(true),
    );
    expect(upsert).toHaveBeenCalledWith(
      { toggle_key: "feature-3", enabled: true },
      { onConflict: "toggle_key,user_id" },
    );
    await act(async () => save({ error: null }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("goes back to what it was when saving fails", async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    upsert.mockResolvedValue({ error: { message: "offline" } });
    const { queryClient, wrapper } = setup();
    const toggles = renderHook(() => useToggles(), { wrapper });
    await waitFor(() => expect(toggles.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useSwitchToggle(), { wrapper });

    act(() => result.current.mutate({ key: "feature-3", on: true }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Couldn't save. Check your connection and try again.",
    );
    expect(cached(queryClient, "feature-3")?.isOn).toBe(false);
  });
});
