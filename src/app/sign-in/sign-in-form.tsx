"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Props = { next: string; error?: string; email?: string };

function messageFor(error: string | undefined, email: string | undefined) {
  if (error === "not_allowed") {
    return `This app is invite-only. Ask the owner to add ${email ?? "your Google email"}.`;
  }
  if (error) return "Something went wrong signing in. Please try again.";
  return null;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function SignInForm({ next, error, email }: Props) {
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);

  const message = startError
    ? "Couldn't start Google sign-in. Please try again."
    : messageFor(error, email);

  async function signIn() {
    setStarting(true);
    setStartError(false);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) {
      setStartError(true);
      setStarting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {message ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm"
        >
          {message}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-3 text-base"
        disabled={starting}
        onClick={signIn}
      >
        <GoogleMark />
        {starting ? "Opening Google…" : "Continue with Google"}
      </Button>
    </div>
  );
}
