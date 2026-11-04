"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  count: number;
  onSelectAll: () => void;
  onDelete: () => void;
  onClear: () => void;
};

// Replaces a screen's header while items are picked (spec 014).
export function SelectionBar({ count, onSelectAll, onDelete, onClear }: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Selection"
      className="flex items-center gap-1"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Cancel selection"
        className="size-11 shrink-0"
        onClick={onClear}
      >
        <X aria-hidden="true" />
      </Button>
      <p
        aria-live="polite"
        className="min-w-0 flex-1 truncate font-semibold text-lg"
      >
        {count} selected
      </p>
      <Button
        type="button"
        variant="ghost"
        className="h-11 shrink-0 px-3"
        onClick={onSelectAll}
      >
        Select all
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="h-11 shrink-0 px-4"
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  );
}
