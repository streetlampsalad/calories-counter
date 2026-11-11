// Where a Bug report's Issue has got to (spec 194 US3.2). The board's sync works the outcome out
// from GitHub (scripts/workflow/bug-reports.mjs); a report that has not been synced yet reads Sent.
export const OUTCOMES = [
  "sent",
  "being_fixed",
  "waiting_for_owner",
  "fixed",
  "not_going_ahead",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  sent: "Sent",
  being_fixed: "Being fixed",
  waiting_for_owner: "Waiting for the owner",
  fixed: "Fixed",
  not_going_ahead: "Not going ahead",
};

export function outcomeOf(value: string | null): Outcome {
  return OUTCOMES.find((outcome) => outcome === value) ?? "sent";
}
