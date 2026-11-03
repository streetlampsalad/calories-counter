"use client";

import { FileUp } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { checkImportFile, type ImportRow, parseImportText } from "./parse";

type Props = {
  /** Called with the rows that were read, ready for Import Review. */
  onRows: (rows: ImportRow[]) => void;
};

// Where the AI's answer comes back in: pasted (easiest on a phone) or chosen as a file.
export function ImportSource({ onRows }: Props) {
  const pasteId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function review(source: string) {
    const result = parseImportText(source);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setText("");
    onRows(result.rows);
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    const rejection = checkImportFile(file);
    if (rejection) {
      setError(rejection);
      return;
    }
    review(await file.text());
  }

  return (
    <section
      aria-labelledby="source-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="source-heading" className="font-medium text-lg">
        Bring the result back
      </h2>

      <Label htmlFor={pasteId}>Paste the result</Label>
      <textarea
        id={pasteId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        placeholder="name,portion,calories"
        className="w-full rounded-lg border border-input bg-transparent p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button
        onClick={() => review(text)}
        disabled={text.trim() === ""}
        className="h-12 text-base"
      >
        Review pasted result
      </Button>

      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="outline"
        onClick={() => fileInput.current?.click()}
        className="h-12 gap-2 text-base"
      >
        <FileUp aria-hidden="true" /> Choose a CSV or JSON file
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        aria-label="CSV or JSON file"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void chooseFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
