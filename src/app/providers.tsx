"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { makeQueryClient } from "@/lib/query-client";

// Clears the 56px nav, the Add button above it, and the phone's gesture bar.
const TOAST_OFFSET = { bottom: "calc(8.75rem + env(safe-area-inset-bottom))" };

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser session; created lazily so it survives re-renders.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Bottom, just above the Add button and bottom nav: within thumb reach for Undo, and never
          covering the header controls at the top of the screen. */}
      <Toaster
        position="bottom-center"
        offset={TOAST_OFFSET}
        mobileOffset={TOAST_OFFSET}
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
