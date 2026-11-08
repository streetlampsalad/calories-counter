import { REPOSITORY, type Stage } from "./domain";

// What a Feature Request's card shows (spec 124 US2): the stage GitHub implies, unless the request
// was withdrawn or its Toggle has since gone Live or been Removed, which GitHub doesn't know.
export type DisplayStage = Stage | "live" | "removed" | "withdrawn";

export const STAGE_TEXT: Record<DisplayStage, string> = {
  submitted: "Submitted",
  being_reviewed: "Being reviewed",
  planning: "Planning",
  building: "Building",
  waiting_for_owner: "Waiting for the owner",
  ready_to_try: "Ready to try",
  not_going_ahead: "Not going ahead",
  live: "Live for everyone",
  removed: "Removed",
  withdrawn: "Withdrawn",
};

export function displayStage(
  request: {
    stage: Stage;
    featureIssue: number | null;
    withdrawnAt: string | null;
  },
  toggles: { key: string; state: string }[],
): DisplayStage {
  if (request.withdrawnAt) return "withdrawn";
  const toggle = toggles.find(
    (candidate) => candidate.key === `feature-${request.featureIssue}`,
  );
  if (toggle?.state === "live") return "live";
  if (toggle?.state === "removed") return "removed";
  return request.stage;
}

export const issueUrl = (number: number) =>
  `https://github.com/${REPOSITORY}/issues/${number}`;

// A request may be withdrawn only before building starts; after that it is tried and Removed (D8).
// Nor once it has been Ready to try, even back at Submitted for a Round: a built feature is in
// production behind its Toggle, and only It's ready or Remove it may end it (spec 135 D12).
export const WITHDRAWABLE: readonly DisplayStage[] = [
  "submitted",
  "being_reviewed",
  "planning",
];

export const canWithdraw = (
  display: DisplayStage,
  firstReadyAt: string | null,
) => firstReadyAt === null && WITHDRAWABLE.includes(display);

// Give feedback, It's ready and Remove it (spec 135 US1.1, US1.8): at Ready to try, or after a
// Round was declined (D13), and only while the request's Toggle is in Testing.
export function canDecide(
  display: DisplayStage,
  toggle: { state: string } | undefined,
  firstReadyAt: string | null = null,
): boolean {
  if (toggle?.state !== "testing") return false;
  return (
    display === "ready_to_try" ||
    (display === "not_going_ahead" && firstReadyAt !== null)
  );
}
