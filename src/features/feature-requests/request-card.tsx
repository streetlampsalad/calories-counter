"use client";

import { type FeatureRequest, useFeatureRequestsAhead } from "./queries";
import { type DisplayStage, issueUrl, STAGE_TEXT } from "./stage";

// One of the User's own Feature Requests: what they asked, where it is, and the latest word on it.
export function RequestCard({
  request,
  display,
}: {
  request: FeatureRequest;
  display: DisplayStage;
}) {
  const ahead = useFeatureRequestsAhead(request.id, display === "submitted");

  return (
    <article
      aria-label={request.goal}
      className="flex flex-col gap-2 rounded-lg border p-4"
    >
      <p className="line-clamp-3 font-medium">{request.goal}</p>
      <p className="font-medium text-sm">{STAGE_TEXT[display]}</p>
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
