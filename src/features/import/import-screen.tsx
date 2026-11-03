"use client";

import { ArrowLeft, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFoods } from "@/features/foods/queries";
import { AI_PROMPT } from "./ai-prompt";
import { DiscardSheet } from "./discard-sheet";
import { ImportSource } from "./import-source";
import { reviewRows } from "./review";
import { ReviewList } from "./review-list";
import { useImportReview } from "./use-import-review";
import { useLeaveGuard } from "./use-leave-guard";

const STEPS = [
  {
    title: "Copy the prompt",
    detail: "It tells the AI exactly what format to answer in.",
  },
  {
    title: "Ask any AI with your photo",
    detail:
      "Open Gemini, ChatGPT or any AI chat, attach a photo of your notes and paste the prompt.",
  },
  {
    title: "Upload or paste the result",
    detail:
      "Bring the CSV or JSON it gives you back here. You review every row before anything is saved.",
  },
];

function PromptSection() {
  const promptRef = useRef<HTMLPreElement>(null);

  function selectPrompt() {
    const node = promptRef.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      toast("Prompt copied");
    } catch {
      selectPrompt();
      toast(
        "Couldn't copy automatically. The prompt is selected, so you can copy it by hand.",
      );
    }
  }

  return (
    <section
      aria-labelledby="prompt-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="prompt-heading" className="font-medium text-lg">
        The prompt
      </h2>
      <pre
        ref={promptRef}
        data-testid="prompt"
        className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm"
      >
        {AI_PROMPT}
      </pre>
      <Button onClick={copyPrompt} className="h-12 gap-2 text-base">
        <Copy aria-hidden="true" /> Copy prompt
      </Button>
    </section>
  );
}

export function ImportScreen() {
  const router = useRouter();
  const { state, dispatch } = useImportReview();
  const { data: foods } = useFoods();
  const hasRows = state.rows.length > 0;
  const { pending, stay } = useLeaveGuard(hasRows);
  const [startingOver, setStartingOver] = useState(false);

  function discard() {
    const destination = pending;
    dispatch({ type: "reset" });
    setStartingOver(false);
    stay();
    if (destination) router.push(destination);
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      <Link
        href="/foods"
        className="flex min-h-11 w-fit items-center gap-1.5 text-muted-foreground text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Foods
      </Link>
      <h1 className="font-semibold text-2xl tracking-tight">
        Import from notes
      </h1>

      {hasRows ? (
        <>
          <ReviewList
            state={state}
            foods={foods ?? []}
            onEdit={(id, field, value) =>
              dispatch({ type: "edit", id, field, value })
            }
            onToggle={(id) => dispatch({ type: "toggle", id })}
            onDuplicate={(id, action) =>
              dispatch({ type: "duplicate", id, action })
            }
          />
          <Button
            variant="outline"
            onClick={() => setStartingOver(true)}
            className="h-12 text-base"
          >
            Start over
          </Button>
        </>
      ) : (
        <>
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm"
                >
                  {index + 1}
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">{step.title}</span>
                  <span className="text-muted-foreground text-sm">
                    {step.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <PromptSection />
          <ImportSource
            onRows={(rows) =>
              dispatch({ type: "load", rows: reviewRows(rows) })
            }
          />
        </>
      )}

      <DiscardSheet
        open={pending !== null || startingOver}
        rows={state.rows.length}
        onKeep={() => {
          stay();
          setStartingOver(false);
        }}
        onDiscard={discard}
      />
    </main>
  );
}
