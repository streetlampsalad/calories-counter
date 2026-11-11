"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { REPOSITORY } from "@/features/feature-requests/domain";
import { cn } from "@/lib/utils";
import { OUTCOME_LABELS, outcomeOf } from "./outcome";
import { useBugReports } from "./queries";

const FEATURE_REQUESTS = "/settings/feature-requests";

// Your bug reports (spec 194 US3.5): what happened to each one, newest first. Shows nothing for a
// User who has sent none. Rows carry the report's id, so a notification can open `#<id>`.
export function ReportList() {
  const { data: reports, isPending, isError, refetch } = useBugReports();

  if (!isPending && !isError && reports.length === 0) return null;

  return (
    <section aria-labelledby="reports-heading" className="flex flex-col gap-3">
      <h2 id="reports-heading" className="font-medium text-lg">
        Your bug reports
      </h2>
      {isPending ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3">
          <p>
            Couldn't load your bug reports. Check your connection and try again.
          </p>
          <Button variant="outline" size="lg" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Your bug reports">
          {reports.map((report) => {
            const outcome = outcomeOf(report.outcome);
            return (
              <li
                key={report.id}
                id={report.id}
                className="flex scroll-mt-4 flex-col gap-2 rounded-lg border p-3"
              >
                <p className="font-medium">
                  {report.issueTitle ?? `Bug #${report.bugIssue}`}
                </p>
                <p className="text-sm" data-outcome>
                  {OUTCOME_LABELS[outcome]}
                </p>
                {outcome === "not_going_ahead" && report.latestComment ? (
                  <p className="whitespace-pre-line text-sm">
                    {report.latestComment}
                  </p>
                ) : null}
                <a
                  href={`https://github.com/${REPOSITORY}/issues/${report.bugIssue}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center underline"
                >
                  See it on GitHub as #{report.bugIssue}
                </a>
                {outcome === "not_going_ahead" ? (
                  <Link
                    href={FEATURE_REQUESTS}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-auto min-h-11 whitespace-normal py-2",
                    )}
                  >
                    Is it something new? Ask for it as a feature.
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
