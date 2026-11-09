"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { ThemeColor } from "@/components/theme-color";
import { Toaster } from "@/components/ui/sonner";
import { AppearanceCleanup } from "@/features/settings/appearance-section";
import { makeQueryClient } from "@/lib/query-client";

// Clears the 56px nav, the Add button above it, and the phone's gesture bar.
const TOAST_OFFSET = { bottom: "calc(8.75rem + env(safe-area-inset-bottom))" };

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser session; created lazily so it survives re-renders.
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AppearanceCleanup />
        <ThemeColor />
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
    </ThemeProvider>
  );
}
