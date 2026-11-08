import { Suspense } from "react";
import { FeatureRequestsGate } from "@/features/feature-requests/gate";
import { RequestForm } from "@/features/feature-requests/request-form";

export default function NewFeatureRequestPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <h1 className="font-semibold text-2xl tracking-tight">
        Request a feature
      </h1>
      <Suspense fallback={<div className="h-64" />}>
        <FeatureRequestsGate>
          <RequestForm />
        </FeatureRequestsGate>
      </Suspense>
    </main>
  );
}
