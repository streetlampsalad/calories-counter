import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { decideAccess } from "@/lib/auth/route-access";
import { publicEnv } from "@/lib/env";

// Refreshes the Supabase session cookie on every request and enforces who may see what.
export async function proxy(request: NextRequest) {
  const env = publicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims validates the token every time; getSession would trust a forgeable cookie.
  const { data } = await supabase.auth.getClaims();

  const access = decideAccess({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    signedIn: Boolean(data?.claims),
  });
  if (access.action === "next") return response;
  if (access.action === "unauthorized") {
    return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  }

  const redirect = NextResponse.redirect(new URL(access.to, request.url));
  // Carry any refreshed session cookies onto the redirect.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Everything except Next.js internals and static files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
