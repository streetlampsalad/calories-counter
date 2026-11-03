import type { Suggestion } from "./suggestions";

export const ESTIMATE_LABEL = "Estimate: check before saving";

export type GuessResult =
  | { kind: "guess"; suggestion: Suggestion }
  | { kind: "unavailable" }
  | { kind: "failed" };

let counter = 0;

// Asks the server for a best guess at a food's Calories, as an estimated Suggestion.
export async function askBestGuess(query: string): Promise<GuessResult> {
  try {
    const response = await fetch("/api/search/guess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    // Out of free quota, the daily limit, or the service being down: the same plain message.
    if (response.status === 503 || response.status === 429) {
      return { kind: "unavailable" };
    }
    if (!response.ok) return { kind: "failed" };
    const { guess } = (await response.json()) as {
      guess: {
        name: string;
        portion: string;
        calories: number;
        basis: string;
      };
    };
    counter += 1;
    return {
      kind: "guess",
      suggestion: {
        key: `guess:${counter}`,
        name: guess.name,
        portion: guess.portion,
        calories: guess.calories,
        basis: guess.basis,
        estimate: true,
        sourceLabel: ESTIMATE_LABEL,
      },
    };
  } catch {
    return { kind: "failed" };
  }
}
