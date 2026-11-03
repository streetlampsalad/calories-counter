import { NextResponse } from "next/server";
import { sanitizeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// The before-user-created hook rejects a stranger with this wording (spec 002); the
// refused email is the only part we take from the provider's error text.
const INVITE_ONLY = /invite-only\. Ask the owner to add ([^\s@]+@[^\s@]+?)\.?$/;

function signInError(
  origin: string,
  error: "not_allowed" | "auth_failed",
  email?: string,
) {
  const url = new URL("/sign-in", origin);
  url.searchParams.set("error", error);
  if (email) url.searchParams.set("email", email);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  if (searchParams.has("error")) {
    const refused = INVITE_ONLY.exec(
      searchParams.get("error_description") ?? "",
    );
    return refused
      ? signInError(origin, "not_allowed", refused[1])
      : signInError(origin, "auth_failed");
  }

  const code = searchParams.get("code");
  if (!code) return signInError(origin, "auth_failed");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return signInError(origin, "auth_failed");

  return NextResponse.redirect(
    new URL(sanitizeNext(searchParams.get("next")), origin),
  );
}
