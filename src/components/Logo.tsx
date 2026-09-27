/* The FORGE marks, the same as the game's (traced by scripts/brand.py): the angled F with its pink accent, or the
   full wordmark. White on dark by default; `ink` is the dark version (pink accent kept) for light backgrounds. */
export function Logo({ mark = false, ink = false, className = "", title = "FORGE" }: { mark?: boolean; ink?: boolean; className?: string; title?: string }) {
  const src = `/brand/forge-${mark ? "mark" : "logo"}${ink ? "-ink" : ""}.svg`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={title} className={className} draggable={false} />;
}
