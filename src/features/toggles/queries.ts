"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type ToggleState = "testing" | "live" | "removed";

export type Toggle = {
  key: string;
  title: string;
  state: ToggleState;
  // Whether it is on for the signed-in User.
  isOn: boolean;
  // Whether they may turn it on or off for themselves (in Testing, and allowed to try it).
  canSwitch: boolean;
};

export const toggleKeys = {
  all: ["toggles"] as const,
  mine: () => [...toggleKeys.all, "mine"] as const,
};

// Every Toggle with the signed-in User's answer, in one request (ADR 0008).
export function useToggles() {
  return useQuery({
    queryKey: toggleKeys.mine(),
    queryFn: async (): Promise<Toggle[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("my_toggles");
      if (error) throw error;
      return data.map((row) => ({
        key: row.key,
        title: row.title,
        state: row.state as ToggleState,
        isOn: row.is_on,
        canSwitch: row.can_switch,
      }));
    },
  });
}

// Whether a Toggle is on for the signed-in User. Off while loading, after an error, and for a
// key no Toggle has, so a feature never shows before the database says it may.
export function useToggle(key: string): boolean {
  const { data } = useToggles();
  return data?.find((toggle) => toggle.key === key)?.isOn ?? false;
}

// Turns a Toggle in Testing on or off for the signed-in User only.
export function useSwitchToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, on }: { key: string; on: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("toggle_overrides")
        .upsert(
          { toggle_key: key, enabled: on },
          { onConflict: "toggle_key,user_id" },
        );
      if (error) {
        throw new Error("Couldn't save. Check your connection and try again.");
      }
    },
    onMutate: async ({ key, on }) => {
      await queryClient.cancelQueries({ queryKey: toggleKeys.all });
      const previous = queryClient.getQueryData<Toggle[]>(toggleKeys.mine());
      queryClient.setQueryData<Toggle[]>(toggleKeys.mine(), (current) =>
        current?.map((toggle) =>
          toggle.key === key ? { ...toggle, isOn: on } : toggle,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) =>
      queryClient.setQueryData(toggleKeys.mine(), context?.previous),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: toggleKeys.all }),
  });
}
