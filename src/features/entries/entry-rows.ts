"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import type { Entry } from "./types";

// How long a removed Entry takes to collapse before it is dropped from the page.
export const LEAVE_MS = 200;

export type EntryRowState = {
  entry: Entry;
  /** Removed, but still on screen while it collapses. Never tappable. */
  leaving: boolean;
  /** Arrived after the list first appeared, so it slides in. Rows already there never animate. */
  animate: boolean;
};

// The rows to draw for the Entries now: every current Entry, in the order given, with each Entry
// that has just gone left in the place it was, marked as leaving. Entries that are new to the
// list are marked to animate in; ones that were already there keep whatever they had.
export function reconcileRows(
  previous: readonly EntryRowState[],
  entries: readonly Entry[],
  keepLeaving: boolean,
): EntryRowState[] {
  const before = new Map(previous.map((row) => [row.entry.id, row]));
  const rows: EntryRowState[] = entries.map((entry) => ({
    entry,
    leaving: false,
    animate: before.get(entry.id)?.animate ?? true,
  }));
  if (!keepLeaving) return rows;

  const current = new Set(entries.map((entry) => entry.id));
  previous.forEach((row, index) => {
    if (current.has(row.entry.id)) return;
    // Back where it was: straight after the nearest earlier row that is still there.
    let position = 0;
    for (let before = index - 1; before >= 0; before -= 1) {
      const found = rows.findIndex(
        (candidate) => candidate.entry.id === previous[before].entry.id,
      );
      if (found !== -1) {
        position = found + 1;
        break;
      }
    }
    rows.splice(position, 0, { ...row, leaving: true });
  });
  return rows;
}

// The list's rows with their animation state (spec 019). The first set of Entries is just there,
// so opening or changing Day animates nothing; an Entry added later slides in, and one removed
// collapses out before it goes. A device that asks for reduced motion gets none of it.
export function useEntryRows(entries: readonly Entry[]) {
  const [rows, setRows] = useState<EntryRowState[]>(() =>
    entries.map((entry) => ({ entry, leaving: false, animate: false })),
  );
  const [source, setSource] = useState(entries);

  // Settled in the same render as the change, so a removed row never blinks out before collapsing.
  if (source !== entries) {
    setSource(entries);
    setRows(reconcileRows(rows, entries, !prefersReducedMotion()));
  }

  useEffect(() => {
    if (!rows.some((row) => row.leaving)) return;
    const timer = setTimeout(
      () => setRows((current) => current.filter((row) => !row.leaving)),
      LEAVE_MS,
    );
    return () => clearTimeout(timer);
  }, [rows]);

  return rows;
}
