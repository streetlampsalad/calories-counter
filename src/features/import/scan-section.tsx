"use client";

import { Camera, Image as ImageIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ScanStatus } from "./use-photo-scan";

type Props = {
  status: ScanStatus;
  /** Rows are already in Import Review, so a photo adds to them. */
  hasRows: boolean;
  onPhoto: (file: File) => void;
  onUseAiApp: () => void;
};

const MESSAGES: Record<"empty" | "failed", { title: string; hint: string }> = {
  empty: {
    title: "Couldn't find any foods in that photo",
    hint: "Try again with the page flat, in good light and filling the frame.",
  },
  failed: {
    title: "Something went wrong reading that photo",
    hint: "Check your connection and try again.",
  },
};

// Take a photo of handwritten notes (or choose one) and have it read into Import Review.
export function ScanSection({ status, hasRows, onPhoto, onUseAiApp }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const reading = status === "reading";

  function chosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPhoto(file);
  }

  return (
    <section
      aria-labelledby="scan-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="scan-heading" className="font-medium text-lg">
        {hasRows ? "Add another photo" : "Scan your notes"}
      </h2>
      {hasRows ? null : (
        <p className="text-muted-foreground text-sm">
          Photograph your handwritten notes and the foods appear below to
          review.
        </p>
      )}

      <Button
        onClick={() => camera.current?.click()}
        disabled={reading}
        className="h-12 gap-2 text-base"
      >
        <Camera aria-hidden="true" />
        {hasRows ? "Take another photo" : "Take a photo"}
      </Button>
      <Button
        variant="outline"
        onClick={() => gallery.current?.click()}
        disabled={reading}
        className="h-12 gap-2 text-base"
      >
        <ImageIcon aria-hidden="true" /> Choose from gallery
      </Button>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Photo from camera"
        className="sr-only"
        tabIndex={-1}
        onChange={chosen}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        aria-label="Photo from gallery"
        className="sr-only"
        tabIndex={-1}
        onChange={chosen}
      />

      {reading ? (
        <output className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
          Reading your notes…
        </output>
      ) : null}

      {status === "empty" || status === "failed" ? (
        <div role="alert" className="flex flex-col gap-1">
          <p className="font-medium">{MESSAGES[status].title}</p>
          <p className="text-muted-foreground text-sm">
            {MESSAGES[status].hint}
          </p>
        </div>
      ) : null}

      {status === "unavailable" ? (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="font-medium">
            Reading photos isn't available right now
          </p>
          <p className="text-muted-foreground text-sm">
            The free photo reader may have hit its limit for today. You can use
            any AI app to read your notes instead.
          </p>
          <Button variant="outline" onClick={onUseAiApp} className="h-11">
            Use an AI app instead
          </Button>
        </div>
      ) : null}
    </section>
  );
}
