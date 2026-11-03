"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { parseGoal } from "./domain";

type Props = {
  open: boolean;
  /** The current Goal, if any. */
  current: number | null;
  /** A number to set the Goal, or null to clear it. */
  onSave: (goal: number | null) => void;
  onClose: () => void;
};

export function GoalSheet({ open, current, onSave, onClose }: Props) {
  const id = useId();
  const [text, setText] = useState(current === null ? "" : String(current));
  const [error, setError] = useState<string | null>(null);

  // Opening again starts from whatever the Goal is now, with no old error showing.
  useEffect(() => {
    if (open) {
      setText(current === null ? "" : String(current));
      setError(null);
    }
  }, [open, current]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    const result = parseGoal(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSave(result.value);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Daily goal</SheetTitle>
          <SheetDescription>
            How many calories you aim to eat each day. Between 500 and 10,000.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={save}
          noValidate
          className="flex flex-col gap-4 px-4 pb-6"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>Calories per day</Label>
            <Input
              id={id}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="done"
              autoComplete="off"
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="h-12 text-base"
            />
            {error ? (
              <p id={`${id}-error`} className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Button type="submit" className="h-12 w-full text-base">
              Save goal
            </Button>
            {current !== null ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full text-base"
                onClick={() => {
                  onSave(null);
                  onClose();
                }}
              >
                Clear goal
              </Button>
            ) : null}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
