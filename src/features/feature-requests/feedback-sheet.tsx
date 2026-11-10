"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  countOpen,
  FEEDBACK_MAX,
  type FeedbackCategory,
  MAX_OPEN,
  MAX_SETS,
  parseSets,
} from "./domain";
import { useGiveFeedback, useMyFeatureRequests } from "./queries";

type DraftSet = { key: number; category: FeedbackCategory; text: string };

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "enhancement", label: "Enhancement" },
  { value: "bug", label: "Bug" },
];

// Give feedback on a request that is Ready to try (spec 135 US1): it becomes another Round, built
// behind the same Toggle. The feedback comes in sets, each an enhancement or a bug (spec 193), and
// every set stays in the sheet until they have been sent.
export function FeedbackSheet({ id, goal }: { id: string; goal: string }) {
  const baseId = useId();
  const nextKey = useRef(1);
  const fresh = (): DraftSet => ({
    key: nextKey.current++,
    category: "enhancement",
    text: "",
  });
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState<DraftSet[]>(() => [
    { key: 0, category: "enhancement", text: "" },
  ]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const { data: requests } = useMyFeatureRequests();
  const give = useGiveFeedback();
  const atLimit =
    countOpen((requests ?? []).filter((request) => request.id !== id)) >=
    MAX_OPEN;

  function change(key: number, update: Partial<DraftSet>) {
    setSets((current) =>
      current.map((set) => (set.key === key ? { ...set, ...update } : set)),
    );
  }

  function clearError(key: number) {
    if (!errors[key]) return;
    setErrors(({ [key]: _, ...rest }) => rest);
  }

  function remove(key: number) {
    // Messages name sets by position, so they are cleared when the positions change.
    setSets((current) => current.filter((set) => set.key !== key));
    setErrors({});
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseSets(
      sets.map(({ category, text }) => ({ category, text })),
    );
    if (!parsed.ok) {
      setErrors(
        Object.fromEntries(
          sets.flatMap((set, index) => {
            const error = parsed.errors[index];
            return error ? [[set.key, error]] : [];
          }),
        ),
      );
      return;
    }
    give.mutate(
      { id, sets: parsed.value },
      {
        onSuccess: () => {
          setOpen(false);
          setSets([fresh()]);
          setErrors({});
        },
        onError: (failure) => toast.error(failure.message),
      },
    );
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-11 self-start"
        onClick={() => setOpen(true)}
      >
        Give feedback
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>What should change?</SheetTitle>
            <SheetDescription>
              About “{goal}”. Your feedback is posted publicly on GitHub, where
              the agents that build it read it. Don't include anything personal.
              You can keep trying it while they work on it.
            </SheetDescription>
          </SheetHeader>
          {atLimit ? (
            <div className="flex flex-col gap-4 px-4 pb-6">
              <p>
                You can have {MAX_OPEN} requests at a time while they're being
                worked on. Once one is ready to try, you can send this.
              </p>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-12 text-base"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              noValidate
              className="flex flex-col gap-4 px-4 pb-6"
            >
              {sets.map((set, index) => {
                const name = `Set ${index + 1}`;
                const fieldId = `${baseId}-${set.key}`;
                const errorId = `${fieldId}-error`;
                const error = errors[set.key];
                return (
                  <fieldset
                    key={set.key}
                    aria-label={name}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={fieldId}>{name}</Label>
                      {sets.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-11"
                          aria-label={`Remove set ${index + 1}`}
                          onClick={() => remove(set.key)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    <Textarea
                      id={fieldId}
                      value={set.text}
                      maxLength={FEEDBACK_MAX}
                      rows={3}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? errorId : undefined}
                      onChange={(event) => {
                        change(set.key, { text: event.target.value });
                        clearError(set.key);
                      }}
                    />
                    <div className="flex gap-4">
                      {CATEGORIES.map((category) => (
                        <label
                          key={category.value}
                          className="flex min-h-11 items-center gap-2 text-base"
                        >
                          <input
                            type="radio"
                            name={`${fieldId}-category`}
                            value={category.value}
                            checked={set.category === category.value}
                            onChange={() =>
                              change(set.key, { category: category.value })
                            }
                            className="size-5 accent-primary"
                          />
                          {category.label}
                        </label>
                      ))}
                    </div>
                    {error ? (
                      <p id={errorId} className="text-destructive text-sm">
                        {error}
                      </p>
                    ) : null}
                  </fieldset>
                );
              })}
              {sets.length < MAX_SETS ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 self-start"
                  onClick={() => setSets((current) => [...current, fresh()])}
                >
                  Add another set
                </Button>
              ) : null}
              <Button
                type="submit"
                disabled={give.isPending}
                className="h-12 text-base"
              >
                {give.isPending ? "Sending…" : "Send feedback"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-12 text-base"
              >
                Cancel
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
