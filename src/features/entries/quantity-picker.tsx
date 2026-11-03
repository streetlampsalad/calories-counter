"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatQuantity,
  MAX_QUANTITY,
  MIN_QUANTITY,
  QUANTITY_PRESETS,
  stepQuantity,
} from "./domain";

type Props = {
  /** Called with the chosen number of Portions. */
  onChoose: (quantity: number) => void;
  /** Where the stepper starts; also what an existing Entry is edited from. */
  initial?: number;
  /** "Add" when logging a Food; "Set to" when changing an Entry's amount. */
  verb?: "Add" | "Set to";
};

// One tap for the usual amounts; the stepper covers everything else in half-portion steps.
export function QuantityPicker({ onChoose, initial = 1, verb = "Add" }: Props) {
  const [custom, setCustom] = useState(initial);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-2">
        {QUANTITY_PRESETS.map((quantity) => (
          <Button
            key={quantity}
            type="button"
            variant="outline"
            aria-label={`${verb} ${formatQuantity(quantity)}`}
            className="h-12 text-lg"
            onClick={() => onChoose(quantity)}
          >
            {formatQuantity(quantity)}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Less"
          className="size-12"
          disabled={custom <= MIN_QUANTITY}
          onClick={() => setCustom(stepQuantity(custom, -1))}
        >
          <Minus aria-hidden="true" />
        </Button>
        <output className="min-w-12 text-center font-semibold text-xl tabular-nums">
          {formatQuantity(custom)}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="More"
          className="size-12"
          disabled={custom >= MAX_QUANTITY}
          onClick={() => setCustom(stepQuantity(custom, 1))}
        >
          <Plus aria-hidden="true" />
        </Button>
        <Button
          type="button"
          className="h-12 flex-1 text-base"
          onClick={() => onChoose(custom)}
        >
          {verb} {formatQuantity(custom)}{" "}
          {custom === 1 ? "portion" : "portions"}
        </Button>
      </div>
    </div>
  );
}
