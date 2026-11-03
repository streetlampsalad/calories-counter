import { Suspense } from "react";
import { SummaryScreen } from "@/features/summary/summary-screen";

export default function SummaryPage() {
  // useSearchParams needs a Suspense boundary: the Period lives in the URL.
  return (
    <Suspense fallback={<main className="flex flex-1" />}>
      <SummaryScreen />
    </Suspense>
  );
}
