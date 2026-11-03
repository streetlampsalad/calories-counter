import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Offline · Calories Counter" };

// Shown by the service worker (public/sw.js) when the app is opened with no connection.
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff aria-hidden="true" className="size-12 text-muted-foreground" />
      <h1 className="font-semibold text-2xl tracking-tight">You're offline.</h1>
      <p className="max-w-64 text-muted-foreground">
        Logging needs a connection.
      </p>
      {/* A plain link, so it is a whole new request: the service worker answers it with this page
          again if there is still no connection, and with the app if there is. */}
      <a href="/" className={cn(buttonVariants(), "h-12 px-8 text-base")}>
        Retry
      </a>
    </main>
  );
}
