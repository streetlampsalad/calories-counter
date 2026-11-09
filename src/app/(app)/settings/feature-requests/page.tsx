import { Suspense } from "react";
import { FeatureRequestsScreen } from "@/features/feature-requests/request-list";

export default function FeatureRequestsPage() {
  return (
    <Suspense fallback={<div className="h-32" />}>
      <FeatureRequestsScreen />
    </Suspense>
  );
}
