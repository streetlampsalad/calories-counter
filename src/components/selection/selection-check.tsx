import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// The round tick at the end of a row while selecting. The row itself says "pressed" to
// assistive technology, so this is only for the eye.
export function SelectionCheck({ picked }: { picked: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-slot="selection-check"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
        picked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/50",
      )}
    >
      {picked ? <Check className="size-4" /> : null}
    </span>
  );
}
