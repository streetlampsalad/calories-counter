"use client";

import { useId } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSwitchToggle } from "@/features/toggles/queries";
import { type FeatureRequest, useFeatureRequestsAhead } from "./queries";
import { type DisplayStage, issueUrl, STAGE_TEXT } from "./stage";

// The request's Toggle as the signed-in User sees it, from my_toggles().
export type RequestToggle = { key: string; isOn: boolean; canSwitch: boolean };

// One of the User's own Feature Requests: what they asked, where it is, and the latest word on it.
// At Ready to try it also says what was built, and gives the Requester its switch (US3.4, US3.5).
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
      {ready && toggle?.canSwitch ? <TryIt toggle={toggle} /> : null}
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
