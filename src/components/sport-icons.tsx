import type { SVGProps } from "react";

/* ─────────────────────────────────────────────────────────────
   Sport glyphs drawn for this app.

   The stock set was generic and in one case simply wrong — a
   sailboat standing in for rowing. These are figures in the
   posture of the sport, on one 24-unit grid with one stroke
   weight, so a row of them reads as a set rather than a pile of
   borrowed pictures.
   ───────────────────────────────────────────────────────────── */

type IconProps = SVGProps<SVGSVGElement> & { strokeWidth?: number };

const Svg = ({ children, strokeWidth = 1.7, ...p }: IconProps & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);

/** Runner: leaning forward, both legs off the ground. */
export const RunIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="15.5" cy="4.5" r="1.8" /><path d="M14 20l-2.2-4.6 3-2.6-1.4-4.1" /><path d="M13.4 8.7L9.6 10l-1.3 3.2" /><path d="M13.4 8.7l3.6 1.6 1.6 3.1" /><path d="M10.6 15.4L6 17.2" /></Svg>
);

/** Trail: the same stride, over a ridge line. */
export const TrailIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="15.8" cy="3.9" r="1.6" /><path d="M14.2 16.6l-1.9-3.8 2.6-2.2-1.2-3.5" /><path d="M13.7 7.1l-3.2 1.1-1.1 2.7" /><path d="M13.7 7.1l3.1 1.4 1.4 2.6" /><path d="M2.5 20.5l4-4.2 2.6 2.3 3.8-4.4 3.1 3 5.5-5.2" /></Svg>
);

/** Ride: two wheels and the rider's line over them. */
export const RideIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="5" cy="17" r="3.4" /><circle cx="19" cy="17" r="3.4" /><circle cx="14.4" cy="4.6" r="1.6" /><path d="M5 17l4.2-5.4h5l-2.4-3.4" /><path d="M11.8 8.2l3.4-.6 2 3.1h-3.6" /><path d="M19 17l-2.4-6.3" /></Svg>
);

/** Walk: upright, an easy stride. */
export const WalkIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12.6" cy="4" r="1.8" /><path d="M12.6 7.4v5.2" /><path d="M12.6 12.6L10 20" /><path d="M12.6 12.6L15.6 20" /><path d="M12.6 8.8L9.4 11" /><path d="M12.6 8.8l3.4 1.8" /></Svg>
);

/** Hike: a walker with poles on a slope. */
export const HikeIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11.6" cy="3.9" r="1.7" /><path d="M11.6 7.2v4.9" /><path d="M11.6 12.1L9.2 19" /><path d="M11.6 12.1L14.6 18" /><path d="M11.6 8.6L8.4 10.4" /><path d="M11.6 8.6l3.2 1.6" /><path d="M17.4 8.4V20" /><path d="M2.6 20.8h18.8" /></Svg>
);

/** Ruck: a walker carrying a loaded pack. */
export const RuckIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12.4" cy="3.8" r="1.7" /><path d="M12.4 7.1v5" /><path d="M12.4 12.1L10 20" /><path d="M12.4 12.1L15.2 20" /><rect x="14.4" y="7" width="5" height="6.4" rx="1.6" /><path d="M14.4 8.6c-1.1 0-2 .6-2 1.6" /><path d="M16 7V5.6" /></Svg>
);

/** Row: seated, legs driving, oar pulled to the chest. */
export const RowIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="8.4" cy="5.2" r="1.7" /><path d="M8.4 8.5l1.6 3.4 4.6.4" /><path d="M10 11.9l-2.4 3.4h-3" /><path d="M3 21h18" /><path d="M14.6 12.3l5.6-4.1" /><path d="M6.4 12.8l-3.2 1.4" /></Svg>
);

/** Ski: crouched, poles back. */
export const SkiIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="13.8" cy="4.2" r="1.7" /><path d="M13.8 7.5l-1.6 3.6 2.6 2.4-.6 3.4" /><path d="M12.2 11.1L8.6 12.4" /><path d="M13.8 8.8l3.4 1.4" /><path d="M18.6 6.4l-2.2 9.8" /><path d="M3 19.6l16.4-3.2" /><path d="M4.6 21.2l16.4-3.2" /></Svg>
);

/** Swim: front crawl, one arm recovering over the water line. */
export const SwimIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="9.4" cy="8.2" r="1.7" /><path d="M11 10.4l4.4 1.6" /><path d="M11 10.4L6.4 8.6 3.4 10" /><path d="M15.4 12l4-4.6" /><path d="M2.6 18.4c1.6-1.2 3-1.2 4.6 0s3 1.2 4.6 0 3-1.2 4.6 0 3 1.2 4.6 0" /></Svg>
);

/** Other: a pulse, for anything the list doesn't name. */
export const OtherIcon = (p: IconProps) => (
  <Svg {...p}><path d="M2.5 12h4l2.2-5.6 3.6 11.2L14.6 12h6.9" /></Svg>
);

/** Mountain bike: knobbly wheels, rider forward over a slope. */
export const MtbIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="5" cy="16.6" r="3.2" /><circle cx="19" cy="16.6" r="3.2" /><circle cx="14.6" cy="4.4" r="1.5" /><path d="M5 16.6l4-5.2h4.8l-2.3-3.2" /><path d="M11.8 8l3.3-.6 1.9 3h-3.4" /><path d="M19 16.6l-2.3-6" /><path d="M2 21h20" /></Svg>
);

/** Gravel: a drop-bar bike over a dashed surface. */
export const GravelIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="5.2" cy="15.4" r="3" /><circle cx="18.8" cy="15.4" r="3" /><circle cx="14.4" cy="4" r="1.5" /><path d="M5.2 15.4l3.8-5h4.6l-2.2-3" /><path d="M11.6 7.4l3.2-.6 1.8 2.9h-3.2" /><path d="M18.8 15.4l-2.2-5.7" /><path d="M2 21h3m3 0h3m3 0h3m3 0h2" /></Svg>
);

/** Inline skate: a boot over a line of wheels. */
export const SkateIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="13.6" cy="4" r="1.7" /><path d="M13.6 7.3v4.4l-3 3.6" /><path d="M13.6 9.4l3.2 1.6" /><path d="M6.4 15.8h9.4" /><circle cx="7.4" cy="18.6" r="1.5" /><circle cx="11.4" cy="18.6" r="1.5" /><circle cx="15.4" cy="18.6" r="1.5" /></Svg>
);

/** Alpine ski: tucked, parallel skis on a fall line. */
export const SkiAlpineIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12.4" cy="4" r="1.7" /><path d="M12.4 7.2l-2 3.4 2.6 2.2-.8 3.2" /><path d="M10.4 10.6L7 11.8" /><path d="M12.4 8.4l3.2 1.4" /><path d="M3 17.6l7.6-1.4" /><path d="M4.4 20.6L12 19.2" /><path d="M17 12.4l2.6 8" /></Svg>
);

/** Snowboard: sideways stance on a single board. */
export const SnowboardIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11.4" cy="4.2" r="1.7" /><path d="M11.4 7.4v3.8" /><path d="M11.4 11.2l-2.2 3.4M11.4 11.2l2.8 3" /><path d="M8.6 8.6L6 10.4M14.2 8.6l3 1" /><path d="M4.4 19.2c1.6-1.6 12.4-5 15.2-6.6" /><path d="M3.4 18c-.6.9-.4 2 .6 2.6M21 11.4c.8.6 1 1.7.4 2.6" /></Svg>
);

/** Ice skate: a blade under a boot. */
export const IceSkateIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="13.4" cy="4" r="1.7" /><path d="M13.4 7.2v4.6l-3.4 3.8" /><path d="M13.4 9.4l3 1.6" /><path d="M5.6 16.4h10.2" /><path d="M6 19.4h10.6c1.4 0 2.4-.6 2.8-1.6" /><path d="M6 16.4v3" /></Svg>
);

/** Kayak: a paddler with a double blade. */
export const KayakIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="5.2" r="1.7" /><path d="M12 8.4v3.2" /><path d="M8.6 9.6l6.8 3.6" /><path d="M6.6 8.6l2.4 1.4M17.4 12.4l-2.4-1.4" /><path d="M2.6 17.4c1.8-1.4 3.4-1.4 5.2 0s3.4 1.4 5.2 0 3.4-1.4 5.2 0 2 1.2 3.2.6" /><path d="M5 14.6h14" /></Svg>
);

/** Surf: a rider crouched on a board in a wave. */
export const SurfIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11.6" cy="4.4" r="1.7" /><path d="M11.6 7.6l-1.8 3 2.6 2.2" /><path d="M9.8 10.6L7 11.6M11.6 8.6l3 1.2" /><path d="M5.6 15.8c3.6-1 9.6-3.2 12.8-5.6" /><path d="M2.6 19.6c1.8-1.4 3.4-1.4 5.2 0s3.4 1.4 5.2 0 3.4-1.4 5.2 0 2 1.2 3.2.6" /></Svg>
);

/** Climbing: a figure reaching up a wall, holds beside it. */
export const ClimbIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="4.6" r="1.7" /><path d="M11 7.8l-.6 4.4 2.6 2.2-.4 3.6" /><path d="M10.4 12.2L7.4 14l-.8 3.4" /><path d="M11 9.2l3.6-2.4" /><path d="M19.6 3.4V20.6" /><circle cx="17" cy="7" r=".9" /><circle cx="17" cy="13.4" r=".9" /></Svg>
);

/** Bouldering: a low traverse under an overhang. */
export const BoulderIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="9.4" cy="8" r="1.7" /><path d="M9.4 11.2l-.4 3.6 2.6 2M9 14.8L6.4 16.6" /><path d="M9.4 12.4l3.4-1.8" /><path d="M3.4 4.6h9.2c3.4 0 5.6 2 5.6 4.6" /><circle cx="15.4" cy="12.4" r=".9" /><path d="M3 20.6h18" /></Svg>
);

/** Soccer: a ball with its panel seams. */
export const SoccerIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.6" /><path d="M12 7.2l3.6 2.6-1.4 4.3H9.8L8.4 9.8z" /><path d="M12 3.4v3.8M19.4 9.4l-3.8.4M16.8 19.2l-2.6-4.9M7.2 19.2l2.6-4.9M4.6 9.4l3.8.4" /></Svg>
);

/** Football: the pointed oval with a lace. */
export const FootballIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.4 12c0-4 3.4-7.4 8.6-7.4S20.6 8 20.6 12s-3.4 7.4-8.6 7.4S3.4 16 3.4 12z" /><path d="M9 12h6" /><path d="M10.6 10.2v3.6M12 9.6v4.8M13.4 10.2v3.6" /></Svg>
);

/** Hockey: a stick and puck. */
export const HockeyIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6.6 3.4l7.8 12.2" /><path d="M14.4 15.6c1.4 2 3 2.4 4.6 1.6" /><ellipse cx="5.2" cy="18.6" rx="2.8" ry="1.4" /><path d="M2.4 18.6v1.2c0 .8 1.2 1.4 2.8 1.4s2.8-.6 2.8-1.4v-1.2" /></Svg>
);

/** Basketball: a ball with its seams. */
export const BasketballIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.6" /><path d="M12 3.4v17.2" /><path d="M3.6 12h16.8" /><path d="M5.8 5.8c3.4 3.4 3.4 9 0 12.4M18.2 5.8c-3.4 3.4-3.4 9 0 12.4" /></Svg>
);

/** Racquet sports: a racquet and ball. */
export const TennisIcon = (p: IconProps) => (
  <Svg {...p}><ellipse cx="9.6" cy="8.4" rx="5.4" ry="6.2" transform="rotate(-32 9.6 8.4)" /><path d="M6.4 5.6l6.6 5.4M12.4 5l-6 6.4" /><path d="M13.6 13.2l5.2 6.4" /><circle cx="18.6" cy="6.6" r="1.8" /></Svg>
);

/** Combat sports: a glove. */
export const CombatIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6.4 9.4c0-2.8 2-4.8 5-4.8h2.2c3 0 5 2 5 4.8v3c0 1.6-.8 2.8-2.2 3.4v2.6c0 1-.8 1.8-1.8 1.8h-5c-1 0-1.8-.8-1.8-1.8v-2.4" /><path d="M6.4 11.6H5c-1 0-1.8.8-1.8 1.8s.8 1.8 1.8 1.8h1.4" /><path d="M7.6 18.4h8.8" /></Svg>
);

/** Skydive: arched freefall under an open canopy. */
export const SkydiveIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.4 8.6c0-3 3.8-5.4 8.6-5.4s8.6 2.4 8.6 5.4" /><path d="M3.4 8.6l7 3.4M20.6 8.6l-7 3.4M12 3.2v8.8" /><circle cx="12" cy="14.4" r="1.6" /><path d="M12 16.4v2.2M10 21l2-2.4 2 2.4" /></Svg>
);

/** Paraglide: a wing on lines with a pilot beneath. */
export const ParaglideIcon = (p: IconProps) => (
  <Svg {...p}><path d="M2.6 7.4c3.4-2.6 6.4-2.6 9.4 0 3-2.6 6-2.6 9.4 0" /><path d="M2.6 7.4c.6 2 1.6 3.2 3 4M21.4 7.4c-.6 2-1.6 3.2-3 4M12 7.4v4" /><circle cx="12" cy="14.6" r="1.6" /><path d="M12 16.6v2M10.2 21l1.8-2.4 1.8 2.4" /></Svg>
);
