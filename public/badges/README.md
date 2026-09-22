# Badge artwork

Drop one file per badge, named after its id in `src/lib/gamification.ts`:

    public/badges/first_session.png
    public/badges/first_session--locked.png    (optional dimmed version)

Then run:

    npm run art

Any badge without a file keeps the drawn emblem, so the set can be filled in
one at a time.

**Format**

- PNG or WebP, transparent background
- Square, 512×512 (it renders at 56–76 px, so this covers 2× and 3× screens)
- Keep the artwork inside ~82% of the canvas: the app reserves the outer ring
  for the progress indicator on locked badges
- No baked-in shadow on the outside edge — the card behind it is light

Without a `--locked` file the app desaturates the earned artwork itself.

Badge ids: first_session, ten_sessions, fifty_sessions, streak_4, streak_12, streak_52, volume_100k, bw_squat, 2x_deadlift, first_pullup, first_route, dist_100k, dist_1000k, everest, sub20_5k, zone2_100h, shared_10, mobility_10h, meals_100
