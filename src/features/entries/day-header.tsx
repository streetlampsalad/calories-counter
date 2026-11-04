"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayLabel, lastPlannableDay, parseDay, shiftDay } from "./days";

type Props = {
  day: string;
  today: string;
  onChange: (day: string) => void;
};

// The Day being viewed, with arrows to step a Day at a time and the phone's own date picker
// behind the label. Days can be planned up to two weeks ahead (spec 013), and no further. Nothing
// here appears or disappears from Day to Day, so nothing below it moves (the way home to today is
// the Today pill beside Add, spec 019).
export function DayHeader({ day, today, onChange }: Props) {
  const last = lastPlannableDay(today);

  function pick(value: string) {
    // An empty value is a cleared picker; anything past the last plannable Day is refused rather
    // than clamped.
    if (!value || value > last) return;
    onChange(parseDay(value, today));
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Previous day"
        className="size-11"
        onClick={() => onChange(shiftDay(day, -1))}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>

      <div className="flex flex-1 flex-col items-center">
        <div className="relative flex min-h-11 w-full items-center justify-center">
          <h1 className="font-semibold text-2xl tracking-tight">
            {dayLabel(day, today)}
          </h1>
          {/* Invisible, but covers the label so a tap opens the native date picker. */}
          <input
            type="date"
            aria-label="Pick a day"
            value={day}
            max={last}
            onChange={(event) => pick(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Next day"
        className="size-11"
        disabled={day >= last}
        onClick={() => onChange(shiftDay(day, 1))}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
