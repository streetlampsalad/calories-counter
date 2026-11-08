"use client";

import { useId } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ToggleState } from "@/features/toggles/queries";
import { useSwitchToggle } from "@/features/toggles/queries";
import { DecideSheet } from "./decide-sheet";
import { FeedbackSheet } from "./feedback-sheet";
import {
  type FeatureRequest,
  type Round,
  useFeatureRequestsAhead,
} from "./queries";
import {
  canDecide,
  canWithdraw,
  type DisplayStage,
  issueUrl,
  STAGE_TEXT,
} from "./stage";
import { WithdrawButton } from "./withdraw-button";

// The request's Toggle as the signed-in User sees it, from my_toggles().
export type RequestToggle = {
  key: string;
  isOn: boolean;
  canSwitch: boolean;
  state: ToggleState;
};

// One of the User's own Feature Requests: what they asked, where it is, and the latest word on it.
// At Ready to try it also says what was built, and gives the Requester its switch (US3.4, US3.5),
// which they keep while a later Round is built (spec 135 US1.6). Feedback starts another Round.
export function RequestCard({
  request,
  display,
  toggle,
}: {
  request: FeatureRequest;
  display: DisplayStage;
  toggle?: RequestToggle;
}) {
  const ahead = useFeatureRequestsAhead(request.id, display === "submitted");
  const ready = display === "ready_to_try";
  const tried = ready || request.firstReadyAt !== null;

  return (
    <article
      aria-label={request.goal}
      className="flex flex-col gap-2 rounded-lg border p-4"
    >
      <p className="line-clamp-3 font-medium">{request.goal}</p>
      <p className="font-medium text-sm">{STAGE_TEXT[display]}</p>
      {ready && request.readyNote ? (
        <p className="whitespace-pre-line text-sm">{request.readyNote}</p>
      ) : null}
      {tried && toggle?.canSwitch && toggle.state === "testing" ? (
        <TryIt toggle={toggle} />
      ) : null}
      {display === "submitted" && ahead.data !== undefined ? (
        <p className="text-muted-foreground text-sm">
          {ahead.data === 0
            ? "Yours is next"
            : `${ahead.data} ${ahead.data === 1 ? "request" : "requests"} ahead of yours`}
        </p>
      ) : null}
      {request.latestComment ? (
        <p className="line-clamp-2 text-muted-foreground text-sm">
          {display === "not_going_ahead"
            ? `Why: ${request.latestComment}`
            : request.latestComment}
        </p>
      ) : null}
      {canDecide(display, toggle, request.firstReadyAt) ? (
        <div className="flex flex-wrap gap-2">
          <FeedbackSheet id={request.id} goal={request.goal} />
          <DecideSheet id={request.id} goal={request.goal} decision="ready" />
        </div>
      ) : null}
      {canWithdraw(display, request.firstReadyAt) ? (
        <WithdrawButton id={request.id} goal={request.goal} />
      ) : null}
      {request.rounds.length > 0 ? <Rounds rounds={request.rounds} /> : null}
      {request.featureIssue ? (
        <a
          href={issueUrl(request.featureIssue)}
          target="_blank"
          rel="noreferrer"
          className="min-h-11 self-start py-2 text-sm underline underline-offset-4"
        >
          See it on GitHub
        </a>
      ) : null}
    </article>
  );
}

// The Requester's feedback so far; the request's own build is Round 1.
function Rounds({ rounds }: { rounds: Round[] }) {
  return (
    <ol aria-label="Rounds" className="flex flex-col gap-2 border-t pt-2">
      {rounds.map((round, index) => {
        const name = `Round ${index + 2}`;
        return (
          <li key={round.id} className="flex flex-col text-sm">
            <span className="font-medium">{name}</span>
            <span className="line-clamp-2 text-muted-foreground">
              {round.feedback}
            </span>
            {round.featureIssue ? (
              <a
                href={issueUrl(round.featureIssue)}
                target="_blank"
                rel="noreferrer"
                aria-label={`${name} on GitHub`}
                className="min-h-11 self-start py-2 underline underline-offset-4"
              >
                See it on GitHub
              </a>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// Another User's request, read-only and without who asked (US2.4).
export function OtherRequestCard({
  goal,
  display,
}: {
  goal: string;
  display: DisplayStage;
}) {
  return (
    <article
      aria-label={goal}
      className="flex flex-col gap-1 rounded-lg border border-dashed p-4"
    >
      <p className="line-clamp-2">{goal}</p>
      <p className="text-muted-foreground text-sm">{STAGE_TEXT[display]}</p>
    </article>
  );
}

// Turns the requested feature on or off for the Requester alone, while its Toggle is in Testing.
function TryIt({ toggle }: { toggle: RequestToggle }) {
  const id = useId();
  const switchToggle = useSwitchToggle();

  function save(on: boolean) {
    switchToggle.mutate(
      { key: toggle.key, on },
      {
        onError: (error) =>
          toast.error(error.message, {
            action: { label: "Retry", onClick: () => save(on) },
          }),
      },
    );
  }

  return (
    // The whole row is the label, so the target is far bigger than the switch itself.
    <Label
      htmlFor={id}
      className="min-h-12 justify-between gap-4 font-medium text-base leading-normal"
    >
      Try it
      <Switch id={id} checked={toggle.isOn} onCheckedChange={save} />
    </Label>
  );
}
