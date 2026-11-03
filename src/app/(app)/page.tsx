import { Suspense } from "react";
import { TodayScreen } from "@/features/entries/today-screen";

export default function TodayPage() {
  // useSearchParams needs a Suspense boundary: the Day is only known on the device.
  return (
    <Suspense fallback={<main className="flex flex-1" />}>
      <TodayScreen />
    </Suspense>
  );
}
