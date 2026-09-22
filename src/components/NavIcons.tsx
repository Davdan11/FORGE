import type { SVGProps } from "react";

/* ─────────────────────────────────────────────────────────────
   FORGE navigation icons. Drawn for the app on a 24 grid, 1.75
   stroke. The line takes the text colour (so the active tab
   turns green with its label); the small volt accents stay volt.
   Same props as a lucide icon, so they drop into the nav as-is.
   ───────────────────────────────────────────────────────────── */

type IconProps = SVGProps<SVGSVGElement> & { strokeWidth?: number };
const VOLT = "var(--volt)";

function Base({ children, strokeWidth = 1.75, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  );
}

export function TodayIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3.25a8.75 8.75 0 1 0 8.75 8.75" />
      <path d="M12 6.3v5.8l3.9 2.25" />
      <circle cx="18.3" cy="5.7" r="2.15" fill={VOLT} fillOpacity=".22" stroke="none" />
      <circle cx="18.3" cy="5.7" r=".78" fill={VOLT} stroke="none" />
    </Base>
  );
}

export function LibraryIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M5 6.15v11.7M19 6.15v11.7M7.25 8.15h9.5M7.25 15.85h9.5" />
      <path d="M3.55 8.1h2.3v7.8h-2.3zM18.15 8.1h2.3v7.8h-2.3z" fill={VOLT} fillOpacity=".18" />
      <path d="M8.55 12h6.9" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function MoveIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M5.05 18.55c1.2-4.6 1.75-8.85 5.65-10.95 2.65-1.43 5.04.04 4.44 2.42-.58 2.32-4.65 2.03-3.76 5.02.55 1.87 3.6 2.1 7.57-.77" />
      <path d="m16.35 13.62 2.8.65-1.02 2.67" />
      <circle cx="5.1" cy="18.45" r="1.7" fill={VOLT} fillOpacity=".22" />
      <circle cx="5.1" cy="18.45" r=".64" fill={VOLT} stroke="none" />
    </Base>
  );
}

export function IndoorIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3.4 18.8 8.8 8.65l3.25 5.05 2.78-3.82 5.75 8.92" />
      <path d="M7.2 18.8 12 13.7l4.82 5.1" />
      <path d="M10.1 20.05 12 15.65l1.92 4.4" />
      <path d="M17.3 4.35v2.5M16.05 5.6h2.5" />
      <path d="M3.4 18.8h17" stroke={VOLT} />
    </Base>
  );
}

export function FoodIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4.15 10.2c.8 5.72 3.38 8.3 7.85 8.3s7.05-2.58 7.85-8.3H4.15Z" fill={VOLT} fillOpacity=".18" />
      <path d="M7.2 7.45c0-1.78 1.05-2.82 2.65-3.45.06 1.72-.63 2.94-2.65 3.45ZM12 7.45c.14-2.15 1.55-3.27 3.45-3.45-.05 2.04-1.18 3.23-3.45 3.45Z" />
      <path d="M4.05 10.2h15.9" />
      <circle cx="12" cy="14.2" r=".9" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function FeedIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="8.1" cy="8.15" r="2.45" fill={VOLT} fillOpacity=".2" />
      <circle cx="8.1" cy="8.15" r="2.45" />
      <circle cx="16.5" cy="9.3" r="1.9" />
      <path d="M3.65 19.25c.58-3.8 2.1-5.38 4.45-5.38s3.87 1.58 4.45 5.38M13.4 19.25c.38-2.6 1.42-3.82 3.1-3.82 1.85 0 3.03 1.34 3.4 3.82M13.2 6.95c.58-.55 1.12-.88 1.95-1.02" />
    </Base>
  );
}

export function ProfileIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 20.2c.55-4.55 3.22-6.75 8-6.75s7.45 2.2 8 6.75" fill={VOLT} fillOpacity=".18" />
      <path d="M12 3.7a4.15 4.15 0 1 1 0 8.3 4.15 4.15 0 0 1 0-8.3Z" />
      <path d="M18.4 4.5v2.85M16.98 5.93h2.85" stroke={VOLT} />
    </Base>
  );
}

/** Anything drawn like a lucide icon: these, or lucide itself. */
export type NavIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;
