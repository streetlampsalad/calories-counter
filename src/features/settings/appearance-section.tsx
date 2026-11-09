"use client";

import { useTheme } from "next-themes";
import {
  APPEARANCES,
  type Appearance,
  parseAppearance,
} from "@/lib/appearance";

const LABELS: Record<Appearance, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

// Appearance (spec 147). The choice is kept on this phone.
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

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
