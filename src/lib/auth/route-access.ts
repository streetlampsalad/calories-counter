const PUBLIC_PATHS = ["/sign-in", "/auth/callback", "/api/health"];

export type Access = { action: "next" } | { action: "redirect"; to: string };

export function decideAccess(input: {
  pathname: string;
  search: string;
  signedIn: boolean;
}): Access {
  const { pathname, search, signedIn } = input;

  if (signedIn) {
    return pathname === "/sign-in"
      ? { action: "redirect", to: "/" }
      : { action: "next" };
  }
  if (PUBLIC_PATHS.includes(pathname)) return { action: "next" };

  return {
    action: "redirect",
    to: `/sign-in?next=${encodeURIComponent(pathname + search)}`,
  };
}
