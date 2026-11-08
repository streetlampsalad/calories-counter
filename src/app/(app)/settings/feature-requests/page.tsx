import { Suspense } from "react";
import { FeatureRequestsGate } from "@/features/feature-requests/gate";
import { FeatureRequestsScreen } from "@/features/feature-requests/request-list";

export default function FeatureRequestsPage() {
  return (
    <Suspense fallback={<div className="h-32" />}>
      <FeatureRequestsGate>
        <FeatureRequestsScreen />
      </FeatureRequestsGate>
    </Suspense>
  );
}
