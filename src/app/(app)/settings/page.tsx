import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { AboutSection } from "@/features/settings/about-section";
import { GoalSection } from "@/features/settings/goal-section";
import { formatVersion } from "@/features/settings/version";
import { VibrationSection } from "@/features/settings/vibration-section";
import { WeekStartSection } from "@/features/settings/week-start-section";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// COMMIT_SHA is passed in by the deploy, so it can only be read per request.
async function About() {
  await connection();
  return <AboutSection version={formatVersion(process.env.COMMIT_SHA)} />;
}

async function Account() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <section aria-labelledby="account-heading" className="flex flex-col gap-3">
      <h2 id="account-heading" className="font-medium text-lg">
        Account
      </h2>
      <p className="text-muted-foreground text-sm">
        Signed in as{" "}
        <span className="font-medium text-foreground">
          {data?.claims.email}
        </span>
      </p>
      <form action={signOut}>
        <Button
          type="submit"
          variant="outline"
          className="h-12 w-full text-base"
        >
          Sign out
        </Button>
      </form>
    </section>
  );
}

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
      <GoalSection />
      <WeekStartSection />
      <VibrationSection />
      <Suspense fallback={<div className="h-32" />}>
        <About />
      </Suspense>
      <Suspense fallback={<div className="h-32" />}>
        <Account />
      </Suspense>
    </main>
  );
}
