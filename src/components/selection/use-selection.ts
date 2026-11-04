"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isSelecting,
  noSelection,
  type Selection,
  selectAll as selectAllIds,
  startSelection,
  toggleSelected,
} from "./selection";

// The picked items of one list. While anything is picked it owns a history entry, so the phone's
// back button leaves selection mode rather than the screen (spec 014 AC-3).
export function useSelection() {
  const [selected, setSelected] = useState<Selection>(noSelection);
  const selecting = isSelecting(selected);
  const pushed = useRef(false);
  const leaving = useRef(false);

  // Declared first, so on unmount it runs before the cleanup below.
  useEffect(() => {
    leaving.current = false;
    return () => {
      leaving.current = true;
    };
  }, []);

  useEffect(() => {
    if (!selecting) return;
    window.history.pushState(null, "", window.location.href);
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      setSelected(noSelection);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Ended on screen (✕, a delete, the last item deselected): hand the history entry back.
      // Not when the screen itself is going away, or going back would undo that navigation.
      if (pushed.current && !leaving.current) {
        pushed.current = false;
        window.history.back();
      }
    };
  }, [selecting]);

  const start = useCallback(
    (id: string) => setSelected(startSelection(id)),
    [],
  );
  const toggle = useCallback(
    (id: string) => setSelected((current) => toggleSelected(current, id)),
    [],
  );
  const selectAll = useCallback(
    (ids: readonly string[]) => setSelected(selectAllIds(ids)),
    [],
  );
  const clear = useCallback(() => setSelected(noSelection), []);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  return {
    selected,
    selecting,
    count: selected.size,
    isSelected,
    start,
    toggle,
    selectAll,
    clear,
  };
}
