import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { summaryKeys } from "@/lib/query-keys";

const maybeSingle = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ maybeSingle: () => maybeSingle() }),
      upsert: (row: unknown, options: unknown) => upsert(row, options),
    }),
  }),
}));

import { DEFAULT_SETTINGS } from "./domain";
import { settingsKeys, useSettings, useUpdateSettings } from "./queries";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useSettings", () => {
  beforeEach(() => maybeSingle.mockReset());

  it("gives the defaults to a User who has never saved settings", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(DEFAULT_SETTINGS);
  });

  it("reads the saved row", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        daily_goal_calories: 2200,
        week_starts_on: 0,
        reminder_enabled: true,
        reminder_time: "07:45:00",
        time_zone: "Australia/Sydney",
        track_calories_burned: true,
      },
      error: null,
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      dailyGoal: 2200,
      weekStartsOn: 0,
      reminderEnabled: true,
      reminderTime: "07:45",
      timeZone: "Australia/Sydney",
      trackCaloriesBurned: true,
    });
  });

  it("reports a failure to load", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "down" } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateSettings", () => {
  beforeEach(() => upsert.mockReset());

  const current = (queryClient: QueryClient) =>
    queryClient.getQueryData(settingsKeys.current());

  it("changes the setting straight away, before the server answers", async () => {
    let finish: (value: unknown) => void = () => {};
    upsert.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(settingsKeys.current(), DEFAULT_SETTINGS);
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => result.current.mutate({ dailyGoal: 2200 }));

    await waitFor(() =>
      expect(current(queryClient)).toEqual({
        ...DEFAULT_SETTINGS,
        dailyGoal: 2200,
      }),
    );
    finish({ error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("saves only what changed, so one setting never overwrites another", async () => {
    upsert.mockResolvedValue({ error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => result.current.mutate({ weekStartsOn: 0 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(upsert).toHaveBeenCalledWith(
      { week_starts_on: 0 },
      { onConflict: "user_id" },
    );
  });

  it("saves a Reminder's switch, time and time zone under their column names", async () => {
    upsert.mockResolvedValue({ error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() =>
      result.current.mutate({
        reminderEnabled: true,
        reminderTime: "07:45",
        timeZone: "Australia/Sydney",
      }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(upsert).toHaveBeenCalledWith(
      {
        reminder_enabled: true,
        reminder_time: "07:45",
        time_zone: "Australia/Sydney",
      },
      { onConflict: "user_id" },
    );
  });

  it("saves the Calories Burned switch under its column name", async () => {
    upsert.mockResolvedValue({ error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => result.current.mutate({ trackCaloriesBurned: true }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(upsert).toHaveBeenCalledWith(
      { track_calories_burned: true },
      { onConflict: "user_id" },
    );
  });

  it("saves a cleared Goal as null", async () => {
    upsert.mockResolvedValue({ error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => result.current.mutate({ dailyGoal: null }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(upsert).toHaveBeenCalledWith(
      { daily_goal_calories: null },
      { onConflict: "user_id" },
    );
  });

  it("puts the old setting back when saving fails", async () => {
    upsert.mockResolvedValue({ error: { code: "08006", message: "down" } });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(settingsKeys.current(), {
      ...DEFAULT_SETTINGS,
      dailyGoal: 2000,
    });
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => result.current.mutate({ dailyGoal: 3000 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Couldn't save your settings. Check your connection and try again.",
    );
    expect(current(queryClient)).toEqual({
      ...DEFAULT_SETTINGS,
      dailyGoal: 2000,
    });
  });

  it("starts from the defaults when nothing was loaded yet", async () => {
    upsert.mockResolvedValue({ error: null });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => result.current.mutate({ dailyGoal: 1800 }));

    await waitFor(() =>
      expect(current(queryClient)).toEqual({
        ...DEFAULT_SETTINGS,
        dailyGoal: 1800,
      }),
    );
  });

  it("refreshes summaries once saved, since they compare with the Goal and the week start", async () => {
    upsert.mockResolvedValue({ error: null });
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => result.current.mutate({ dailyGoal: 2200 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(settingsKeys.all);
    expect(keys).toContainEqual(summaryKeys.all);
  });
});
