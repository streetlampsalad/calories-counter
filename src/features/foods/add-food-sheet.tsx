"use client";

import {
  Camera,
  ChevronRight,
  FileText,
  PencilLine,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { setPendingPhoto } from "@/features/import/photo-handoff";
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

const ROW_CLASS =
  "flex min-h-16 w-full items-center gap-3 rounded-lg border px-4 text-left";

// Each way of adding a Food is an option here; the other specs add theirs (scan, search).
// Manual entry swaps the sheet's content; the others open a screen of their own.
type Option = {
  label: string;
  hint: string;
  icon: typeof PencilLine;
} & ({ mode: "manual" } | { href: string } | { scan: true });

const OPTIONS: Option[] = [
  {
    mode: "manual",
    label: "Enter manually",
    hint: "Type a name, portion and calories",
    icon: PencilLine,
  },
  {
    href: "/foods/search",
    label: "Search",
    hint: "Look up a food by name",
    icon: Search,
  },
  {
    scan: true,
    label: "Scan notes",
    hint: "Take a photo of your handwritten notes",
    icon: Camera,
  },
  {
    href: "/foods/import",
    label: "Import from notes",
    hint: "Turn a photo of handwritten notes into foods",
    icon: FileText,
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
  const router = useRouter();

  // The photo is read on the import screen, so it travels there with the User.
  function scanned(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPendingPhoto(file);
    onClose();
    router.push("/foods/import");
  }

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
              {OPTIONS.map((option) => {
                const Icon = option.icon;
                const content = (
                  <>
                    <Icon
                      aria-hidden="true"
                      className="size-5 text-muted-foreground"
                    />
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-muted-foreground text-sm">
                        {option.hint}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  </>
                );
                return (
                  <li key={option.label}>
                    {"scan" in option ? (
                      <label className={ROW_CLASS}>
                        {content}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="sr-only"
                          onChange={scanned}
                        />
                      </label>
                    ) : "href" in option ? (
                      <Link href={option.href} className={ROW_CLASS}>
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMode(option.mode)}
                        className={ROW_CLASS}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
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
