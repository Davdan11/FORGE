/* ─────────────────────────────────────────────────────────────
   Differences the native shell forces on us.

   One so far, and it cost an afternoon to find: Capacitor's iOS
   scheme handler serves files, not directories. Ask it for
   "/onboarding/" and it returns nothing at all — no error, no
   404, just a blank document — where any web server would have
   handed back "/onboarding/index.html".

   That only bites on a HARD navigation. Links inside the app go
   through the Next client router, which swaps the page without
   ever asking the handler for a document.
   ───────────────────────────────────────────────────────────── */

/** True inside the iOS or Android shell, false in any browser. */
export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  return "Capacitor" in window || window.location.protocol === "capacitor:" || window.location.protocol === "ionic:";
}

/**
 * A route to load with `window.location`.
 *
 * `route` must be a directory path ending in "/" — which is what
 * `trailingSlash: true` produces for every page in the static export.
 */
export function documentUrl(route: string): string {
  if (!route.endsWith("/")) return route;
  return isNativeShell() ? `${route}index.html` : route;
}
