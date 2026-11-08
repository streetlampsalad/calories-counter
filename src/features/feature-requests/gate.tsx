import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isToggleOn } from "@/features/toggles/server";
import { FEATURE_REQUESTS_TOGGLE } from "./domain";

// Feature Requests' pages are not found while their Toggle is off for this User (ADR 0008).
export async function FeatureRequestsGate({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isToggleOn(FEATURE_REQUESTS_TOGGLE))) notFound();
  return children;
}
