"use client";

import { useEffect, useReducer, useState } from "react";
import {
  initialReview,
  type ReviewAction,
  type ReviewState,
  restoreReview,
  reviewReducer,
} from "./review";

const STORAGE_KEY = "import-review";

// Import Review lives in this tab's session storage until it is saved or discarded, because
// switching to an AI app and back can make Android reload the page.
export function useImportReview(): {
  state: ReviewState;
  dispatch: (action: ReviewAction) => void;
  ready: boolean;
} {
  const [state, dispatch] = useReducer(reviewReducer, initialReview);
  const [ready, setReady] = useState(false);

  // Read after mount, so the first render matches the server's.
  useEffect(() => {
    try {
      const saved = restoreReview(sessionStorage.getItem(STORAGE_KEY));
      if (saved) dispatch({ type: "restore", state: saved });
    } catch {
      // Storage is unavailable (a private window, say): carry on without it.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      if (state.rows.length > 0) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // As above.
    }
  }, [state, ready]);

  return { state, dispatch, ready };
}
