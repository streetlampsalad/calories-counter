import { connection } from "next/server";
import { Suspense } from "react";
import { BugReportForm } from "@/features/bug-reports/bug-report-form";
import { ReportList } from "@/features/bug-reports/report-list";
import { formatVersion } from "@/features/settings/version";

// COMMIT_SHA (passed in by the deploy) is read per request, so it sits inside Suspense.
async function Page() {
  await connection();
  return (
    <main className="flex flex-1 flex-col gap-6">
      <h1 className="font-semibold text-2xl tracking-tight">Report a bug</h1>
      <BugReportForm version={formatVersion(process.env.COMMIT_SHA)} />
      <ReportList />
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
