export type NavKey = "requests" | "replays" | "collections" | "settings";

function isPathnameUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Maps the current browser path to the sidebar navigation item that must be
 * highlighted. Derived from the route (pathname), not component state, so
 * the highlight survives refresh and browser back/forward navigation.
 */
export function activeNavForPathname(
  pathname: string | null | undefined,
): NavKey {
  if (!pathname) return "requests";

  if (isPathnameUnder(pathname, "/replays")) return "replays";
  if (isPathnameUnder(pathname, "/collections")) return "collections";
  if (pathname.startsWith("/projects") && pathname.endsWith("/settings")) {
    return "settings";
  }

  return "requests";
}

export function getMethodClass(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "text-[#e4e4e7]";
    case "POST":
      return "text-[#fafafa]";
    case "PUT":
      return "text-[#d4d4d8]";
    case "PATCH":
      return "text-[#d4d4d8]";
    case "DELETE":
      return "text-[#a1a1aa]";
    case "HEAD":
      return "text-[#d4d4d8]";
    case "OPTIONS":
      return "text-[#a1a1aa]";
    default:
      return "text-[#e4e4e7]";
  }
}

export function getStatusClass(status: number | null): string {
  if (status === null) return "text-[#71717a]";
  if (status >= 200 && status < 300) return "text-emerald-400";
  if (status >= 300 && status < 400) return "text-amber-400";
  if (status >= 400 && status < 500) return "text-orange-400";
  if (status >= 500) return "text-red-400";
  return "text-[#e4e4e7]";
}
