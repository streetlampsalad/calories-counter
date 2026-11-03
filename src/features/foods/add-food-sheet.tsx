"use client";

import { ChevronRight, PencilLine } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { findDuplicate } from "./domain";
import { FoodForm } from "./food-form";
import type { Food, FoodInput } from "./types";

type Props = {
  open: boolean;
  foods: readonly Food[];
  /** Adds the Food to the list (optimistically). The sheet decides whether to close. */
  onSave: (food: FoodInput) => void;
  /** Opens a Food the User already has, when what they typed duplicates it. */
  onEditExisting?: (food: Food) => void;
  onClose: () => void;
};

type Mode = "choose" | "manual";

// Each way of adding a Food is an option here; the other specs add theirs (import, scan, search).
const OPTIONS = [
  {
    mode: "manual" as const,
    label: "Enter manually",
    hint: "Type a name, portion and calories",
    icon: PencilLine,
  },
];

export function AddFoodSheet({
  open,
  foods,
  onSave,
  onEditExisting,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("choose");

  // Always start from the choices when the sheet is opened again.
  useEffect(() => {
    if (open) setMode("choose");
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add food</SheetTitle>
          <SheetDescription>
            Calories are for one portion, like 1 slice or 100 g.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {mode === "choose" ? (
            <ul className="flex flex-col gap-2">
              {OPTIONS.map(({ mode: optionMode, label, hint, icon: Icon }) => (
                <li key={optionMode}>
                  <button
                    type="button"
                    onClick={() => setMode(optionMode)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-lg border px-4 text-left"
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-5 text-muted-foreground"
                    />
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground text-sm">
                        {hint}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <FoodForm
              findExisting={(input) => findDuplicate(foods, input)}
              onEditExisting={onEditExisting}
              onSubmit={(input) => {
                onSave(input);
                onClose();
              }}
              onSubmitAnother={onSave}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
