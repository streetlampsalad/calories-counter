"use client";

import { ArrowLeft, Copy } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AI_PROMPT } from "./ai-prompt";

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

export function ImportScreen() {
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
    </main>
  );
}
