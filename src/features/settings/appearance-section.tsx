"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useToggle, useToggles } from "@/features/toggles/queries";
import {
  APPEARANCES,
  type Appearance,
  clearSavedAppearance,
  hasSavedAppearance,
  parseAppearance,
} from "@/lib/appearance";

export const APPEARANCE_TOGGLE = "feature-146";

const LABELS: Record<Appearance, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

// Appearance (spec 147), there only while its Toggle is on. The choice is kept on this phone.
export function AppearanceSection() {
  const on = useToggle(APPEARANCE_TOGGLE);
  const { theme, setTheme } = useTheme();
  if (!on) return null;

  const current = parseAppearance(theme);

  return (
    <section className="flex flex-col gap-2">
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium text-lg">Appearance</legend>
        {APPEARANCES.map((appearance) => (
          <label
            key={appearance}
            className="flex min-h-12 items-center gap-3 text-base"
          >
            <input
              type="radio"
              name="appearance"
              value={appearance}
              checked={current === appearance}
              onChange={() => setTheme(appearance)}
              className="size-5 accent-primary"
            />
            {LABELS[appearance]}
          </label>
        ))}
      </fieldset>
      <p className="text-muted-foreground text-sm">
        System follows your phone. This is saved on this phone only.
      </p>
    </section>
  );
}

// A saved choice is applied before Toggles can load, so nobody is stuck in Dark once the Toggle
// is off for them: when Toggles have loaded off, the choice is cleared and the app goes Light.
// A failed or slow load leaves it alone.
export function AppearanceCleanup() {
  const { data, isSuccess } = useToggles();
  const { setTheme } = useTheme();
  const off =
    isSuccess &&
    !(data?.find((toggle) => toggle.key === APPEARANCE_TOGGLE)?.isOn ?? false);

  useEffect(() => {
    if (!off || !hasSavedAppearance()) return;
    setTheme("light");
    clearSavedAppearance();
  }, [off, setTheme]);

  return null;
}
