"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STAGE_LABELS } from "./domain";
import { type FeatureRequest, useMyFeatureRequests } from "./queries";

// The User's Feature Requests and where each one is (spec 124), with Request a feature in thumb
// reach above the bottom navigation.
export function FeatureRequestsScreen() {
  const {
    data: requests,
    isPending,
    isError,
    refetch,
  } = useMyFeatureRequests();

  return (
    <main className="flex flex-1 flex-col gap-6 pb-20">
      <h1 className="font-semibold text-2xl tracking-tight">
        Feature requests
      </h1>

      {isPending ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3">
          <p>
            Couldn't load your requests. Check your connection and try again.
          </p>
          <Button variant="outline" size="lg" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : requests.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing requested yet. What would make the app better for you?
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Your requests">
          {requests.map((request) => (
            <li key={request.id} id={request.id}>
              <RequestCard request={request} />
            </li>
          ))}
        </ul>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto flex max-w-md justify-end px-4">
        <Link
          href="/settings/feature-requests/new"
          className={cn(
            buttonVariants(),
            "pointer-events-auto h-14 gap-2 rounded-full px-6 text-base shadow-lg",
          )}
        >
          <Plus aria-hidden="true" /> Request a feature
        </Link>
      </div>
    </main>
  );
}

function RequestCard({ request }: { request: FeatureRequest }) {
  const stage = request.withdrawnAt ? "Withdrawn" : STAGE_LABELS[request.stage];

  return (
    <article
      aria-label={request.goal}
      className="flex flex-col gap-2 rounded-lg border p-4"
    >
      <p className="line-clamp-3 font-medium">{request.goal}</p>
      <p className="text-muted-foreground text-sm">{stage}</p>
    </article>
  );
}
