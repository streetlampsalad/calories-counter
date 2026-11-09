"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { hasSavedAppearance, themeColor } from "@/lib/appearance";

// Makes the browser's theme colour follow the chosen appearance, whatever the phone's own setting.
// Until a choice is saved the layout's light/dark media pair stays as it is today (US2.4).
export function ThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme || !hasSavedAppearance()) return;
    const metas = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    );
    const originals = metas.map((meta) => meta.content);
    for (const meta of metas) meta.content = themeColor(resolvedTheme);
    return () => {
      metas.forEach((meta, i) => {
        meta.content = originals[i];
      });
    };
  }, [resolvedTheme]);

  return null;
}
