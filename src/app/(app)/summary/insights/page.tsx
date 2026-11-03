import { Suspense } from "react";
import { InsightsScreen } from "@/features/summary/insights-screen";

export default function InsightsPage() {
  // useSearchParams needs a Suspense boundary: the range lives in the URL.
  return (
    <Suspense fallback={<main className="flex flex-1" />}>
      <InsightsScreen />
    </Suspense>
  );
}
