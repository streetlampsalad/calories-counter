import { connection } from "next/server";
import { Suspense } from "react";
import { AboutSection } from "@/features/settings/about-section";
import { SettingsHome } from "@/features/settings/settings-categories";
import { SignOutForm } from "@/features/settings/sign-out-form";
import { formatVersion } from "@/features/settings/version";
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
      <SignOutForm action={signOut} />
    </section>
  );
}

export default function SettingsPage() {
  return (
    <SettingsHome>
      <Suspense fallback={<div className="h-32" />}>
        <About />
      </Suspense>
      <Suspense fallback={<div className="h-32" />}>
        <Account />
      </Suspense>
    </SettingsHome>
  );
}
