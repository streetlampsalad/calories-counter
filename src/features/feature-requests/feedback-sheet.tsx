"use client";

import { type FormEvent, useId, useState } from "react";
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
import { countOpen, FEEDBACK_MAX, MAX_OPEN, parseFeedback } from "./domain";
import { useGiveFeedback, useMyFeatureRequests } from "./queries";

// Give feedback on a request that is Ready to try (spec 135 US1): it becomes another Round, built
// behind the same Toggle. The text stays in the sheet until it has been sent.
export function FeedbackSheet({ id, goal }: { id: string; goal: string }) {
  const fieldId = useId();
  const errorId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const { data: requests } = useMyFeatureRequests();
  const give = useGiveFeedback();
  const atLimit =
    countOpen((requests ?? []).filter((request) => request.id !== id)) >=
    MAX_OPEN;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseFeedback(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    give.mutate(
      { id, feedback: parsed.value },
      {
        onSuccess: () => {
          setOpen(false);
          setText("");
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
        <SheetContent side="bottom">
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
              <div className="flex flex-col gap-2">
                <Label htmlFor={fieldId} className="sr-only">
                  What should change?
                </Label>
                <Textarea
                  id={fieldId}
                  value={text}
                  maxLength={FEEDBACK_MAX}
                  rows={4}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(event) => {
                    setText(event.target.value);
                    if (error) setError(undefined);
                  }}
                />
                {error ? (
                  <p id={errorId} className="text-destructive text-sm">
                    {error}
                  </p>
                ) : null}
              </div>
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
