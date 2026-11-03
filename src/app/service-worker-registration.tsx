"use client";

import { useEffect } from "react";

// Registers the service worker that shows the offline page. Production only: in development a
// worker would keep old copies of files and confuse every reload.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // No offline page then, which is all that is lost.
      });
  }, []);

  return null;
}
