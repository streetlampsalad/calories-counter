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
