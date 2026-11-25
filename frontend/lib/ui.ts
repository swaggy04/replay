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
      return "text-emerald-400";
    case "POST":
      return "text-[#F4D77E]";
    case "PUT":
      return "text-blue-400";
    case "PATCH":
      return "text-purple-400";
    case "DELETE":
      return "text-red-400";
    case "HEAD":
      return "text-emerald-300";
    case "OPTIONS":
      return "text-pink-400";
    default:
      return "text-[#d8d4d5]";
  }
}

export function getStatusClass(status: number | null): string {
  if (status === null) return "text-[#777174]";
  if (status >= 200 && status < 300) return "text-emerald-400";
  if (status >= 300 && status < 400) return "text-amber-400";
  if (status >= 400 && status < 500) return "text-orange-400";
  if (status >= 500) return "text-red-400";
  return "text-[#d8d4d5]";
}
