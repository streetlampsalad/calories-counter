"use client";

import { useEffect, useState } from "react";

// While `active`, a tap on any link to elsewhere in the app is held back and reported as `pending`,
// so the screen can ask before letting go of unsaved work. Clear it with `stay`.
export function useLeaveGuard(active: boolean) {
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href?.startsWith("/")) return;
      if (anchor.getAttribute("target") === "_blank") return;
      event.preventDefault();
      event.stopPropagation();
      setPending(href);
    };
    // Capture phase, so it runs before the router's own handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active]);

  return { pending, stay: () => setPending(null) };
}
