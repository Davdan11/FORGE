"use client";

import { useT } from "@/lib/i18n";
import { routePath, type PublicRoute } from "@/lib/social/privacy";

/* ─────────────────────────────────────────────────────────────
   A published route, drawn as a shape rather than placed on a map.

   No basemap, deliberately. A trimmed route over street tiles
   invites the reader to work out which streets, and the whole
   point of the trim was to stop the route answering that. The
   shape is what carries the meaning anyway — a hill loop reads as
   a hill loop, an out-and-back reads as an out-and-back — and it
   costs no tile requests in a list that may hold forty of these.
   ───────────────────────────────────────────────────────────── */

export function RouteThumb({ route, className = "", strokeWidth = 2.4 }: {
  route: PublicRoute;
  className?: string;
  strokeWidth?: number;
}) {
  const t = useT();
  const d = routePath(route);
  if (!d) return <EmptyThumb className={className} />;

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={t("Forme du parcours", "Route shape")} preserveAspectRatio="xMidYMid meet">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth * 3} strokeOpacity={0.16} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Some activities have no publishable route — a treadmill run, or a loop too
 *  short to trim. They are still real training, so they get a mark of their
 *  own rather than an empty hole where a map would be. */
function EmptyThumb({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={t("Aucun parcours", "No route")} preserveAspectRatio="xMidYMid meet">
      <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" strokeOpacity={0.28} strokeWidth="2.4" strokeDasharray="5 7" strokeLinecap="round" />
    </svg>
  );
}
