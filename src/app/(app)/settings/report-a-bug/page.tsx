import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BugReportForm } from "@/features/bug-reports/bug-report-form";
import { TOGGLE_KEY } from "@/features/bug-reports/domain";
import { formatVersion } from "@/features/settings/version";
import { isToggleOn } from "@/features/toggles/server";

// Answers not found unless feature-192 is on for the User (spec 194 FR-001). The check and
// COMMIT_SHA (passed in by the deploy) are read per request, so they sit inside Suspense.
async function Page() {
  await connection();
  if (!(await isToggleOn(TOGGLE_KEY))) notFound();
  return (
    <main className="flex flex-1 flex-col gap-6">
      <h1 className="font-semibold text-2xl tracking-tight">Report a bug</h1>
      <BugReportForm version={formatVersion(process.env.COMMIT_SHA)} />
    </main>
  );
}

export default function ReportABugPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <Page />
    </Suspense>
  );
}
