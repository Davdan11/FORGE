# FORGE — the complete training app

Free, worldwide, offline-first PWA. Strength, endurance, mobility, nutrition and recovery in one engine that adapts before you train.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first visit is the 8-minute assessment; it builds a 12-week block and today's meals on the device (IndexedDB). No account needed.

Install as an app: Chrome/Edge → "Install FORGE"; iOS Safari → Share → Add to Home Screen.

## What's in v0.1

| Area | Where | Status |
|---|---|---|
| Assessment → profile | `src/app/onboarding` | ✅ |
| Plan engine (12-week block, 3 mesocycles, deloads, yearly season phases) | `src/lib/engine/plan.ts` | ✅ |
| Readiness check-in → daily auto-regulation + real-life mode (time, gear, pain) | `src/lib/engine/readiness.ts` | ✅ |
| In-session RPE auto-regulation with "why" | `src/lib/engine/autoregulate.ts` | ✅ |
| Session log (sets, RPE, rest timer, swaps, e1RM) | `src/app/(app)/session/[id]` | ✅ |
| Exercise bank (70+ structured movements, cues, faults, swaps, pain flags) | `src/lib/data/exercises.ts` | ✅ — 3D models attach via `model3d` when the media pack exists |
| GPS recording, route map, splits, elevation | `src/app/(app)/move`, `src/lib/geo.ts` | ✅ (browser Geolocation; background tracking needs the native wrapper) |
| Nutrition engine (targets by goal/day type, no-repeat meals, groceries, nudges) | `src/lib/nutrition/engine.ts` | ✅ |
| XP, levels, ranks, badges, streaks | `src/lib/gamification.ts`, `src/lib/progress.ts` | ✅ |
| PWA (manifest, service worker, offline shell, notifications) | `public/` | ✅ |
| Supabase auth + sync | `src/lib/supabase`, `src/lib/sync.ts`, `supabase/schema.sql` | ✅ push sync; pull/merge is v0.2 |
| Today: week ring, recovery clock, sleep debt + 7-day readiness trend, main-lift preview with e1RM delta, muscles/tonnage planned, quick actions | `src/app/(app)/today` | ✅ v0.5 |
| Guided 12-minute mobility flow (six moves, timer, side switch buzz, XP) | `src/components/MobilityFlow.tsx` | ✅ v0.5 |
| Session: live tonnage, warm-up ramp, plate calculator, tempo coach (rig animates at prescribed tempo), ±2.5 kg / ±1 rep steppers, last-time + best e1RM, next-up card, session note, muscles in summary | `src/app/(app)/session/[id]`, `src/lib/units.ts` (`platesFor`) | ✅ v0.5 |
| Anatomical muscle map (front/back, primary red, secondary ember) on library detail, session card, Today, summary | `src/components/MuscleMap.tsx` | ✅ v0.5 — 2D chart; a rigged 3D anatomical model plugs into `model3d` when assets exist |
| MoveRig v2: solid shaded silhouette, depth parallax, real barbell/dumbbell/kettlebell props, working muscles lit in red on the figure | `src/components/MoveRig.tsx` | ✅ v0.5 |
| Desktop shell (sidebar ≥1024px, hero cards, two-column Today/Session/Food/Library detail, 4-col library, 3-col workouts), monochrome editorial photo grade (`.photo`; recipes stay in colour via `color`), exercise photos with slow drift until 3D loops land | `src/components/SideNav.tsx`, `src/app/(app)/layout.tsx`, `src/components/ui.tsx`, `globals.css` | ✅ v0.6 |
| Move = map-first record (live basemap, sport chips with Lucide icons, start sheet), Food = editorial meal timeline; MapLibre 6 worker self-hosted in `public/vendor` (`npm run map:worker`, runs on postinstall) because Turbopack cannot serve `import.meta.url` workers | `src/app/(app)/move`, `src/app/(app)/food`, `src/components/MapView.tsx` | ✅ v0.6 |
| Progress = block position (week/meso/deload), records with photos, recent sessions as cards, consistency + minutes in one card, body card (weight + readiness), Lucide badges; Onboarding = split-screen on desktop (photo + claim per step, 560px form), goal photo cards | `src/app/(app)/progress`, `src/app/onboarding` | ✅ v0.6 |
| Plan = week picker + session photo cards + block summary (mesocycles, intent, % done); Settings = profile card, goal photo tiles, schedule/minutes rebuild the remaining weeks, preferences, user-facing account copy | `src/app/(app)/plan`, `src/app/(app)/settings` | ✅ v0.6 |
| v0.7 light editorial theme (paper, ink, green accent, B&W photos), Lucide icons everywhere, procedural rigs removed; Today player card + daily quests (`src/lib/quests.ts`); Move: locate-me, light basemap, sport-specific rate (pace / per-100 m / speed) and fields (pool+laps, ski discipline, bike); recipe “why this, today”; exercise “in your block” | app-wide | ✅ v0.7 |
| Community, crews, city leaderboards | — | phase 2 (schema has a `leaderboard` table ready) |
| Wearable imports (Garmin, Apple Health…) | — | phase 2 |
| 3D motion-capture library | — | needs assets; schema is ready |

## Supabase (accounts + sync)

1. Create a project at supabase.com.
2. SQL editor → paste and run `supabase/schema.sql`.
3. Authentication → Providers → enable Email (magic link).
4. Copy `.env.local.example` to `.env.local`, fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project settings → API).
5. Restart `npm run dev`. Settings → Account → send a magic link → Sync now.

Without it, everything still works locally.

## Structure

```
src/app/            routes (onboarding, today, session, plan, library, move, food, progress, settings)
src/lib/types.ts    every domain type
src/lib/db.ts       Dexie (IndexedDB) store, local-first
src/lib/engine/     plan · readiness · autoregulate
src/lib/nutrition/  targets · meal days · groceries · nudges
src/lib/data/       exercise bank · meal bank
src/lib/geo.ts      haversine, splits, GPS noise filter
src/components/     UI primitives, bottom nav, map
public/sw.js        offline shell + notification relay
supabase/schema.sql tables + RLS
```

## Design

Same art direction as the marketing site: ink black, warm bone, one volt accent, Archivo (expanded) + Instrument Serif italic. Tokens live in `src/app/globals.css`.

v0.2 polish: photo heroes on every screen (`src/lib/data/images.ts` maps exercises/sessions to verified Unsplash photos — swap for the media pack), `motion` (Framer Motion) for page transitions, staggered lists, rings, count-ups and the session summary (`src/components/motion.tsx`), skeleton loaders, animated bottom nav. Food has 44 photographed recipes with a step-by-step **cook mode** (auto timers parsed from "N min" in each step) at `/food/[id]`.

v0.3 Move & Progress: Strava-style recorder — 10 sports, live HUD (distance/time/pace/climb), **16 guided cardio workouts** (`src/lib/data/workouts.ts`) played back with per-segment countdown, zone target, cue, vibration and auto laps; save sheet (title, sport, feel, note, share toggle, XP breakdown); activity page with elevation profile, splits, laps, max speed, moving time, **share card** (canvas PNG via Web Share) and **post to profile** (+40 XP). Progress = profile: rank ladder, 12-week consistency heatmap, weekly minutes, body-weight log + trend, readiness trend, e1RM sparklines, **Feed** of shared activities with route cards, badges with progress bars. Charts in `src/components/charts.tsx` (single hue, tap tooltips).

v0.4 Recipes & motion: **30,150 recipes** — 46 curated + a generator (`src/lib/nutrition/recipes.ts`) that builds coherent recipes from 17 templates × a real ingredient nutrition table (`ingredients.ts`, per-100 g kcal/protein/carbs/sugar/fat/fibre, cook lines with temps/times per method). Every recipe has exact measures (dry↔cooked for grains), assembled steps, diet tags, sugar/fibre; ids are deterministic (`g:<template>:<ingredients>`) and rebuilt on demand. The nutrition engine scores candidates per slot for the user's **goal** (cut/build/recomp/endurance…), with a per-slot sugar budget, no repeats over 3 days, and `/food/browse` searches the whole catalog. **MoveRig** (`src/components/MoveRig.tsx`) is a procedural side-view athlete animation (forward kinematics + keyframed joint angles, props: bar/dumbbell/kettlebell/bench/pull-up bar) — every exercise maps to a looping motion; real mocap/3D can replace it per-exercise via `model3d` later.

Gotcha: plain CSS in `globals.css` sits above Tailwind's utility layer, so never set `position` in a shared class like `.photo` — it would override `absolute`/`fixed` utilities.

## Exercise loops (3D anatomical renders)

The reference look — grey anatomical mannequin, working muscle lit red, seamless loop — is a **rendered asset per exercise**, not something drawn in code. The app is wired for it:

- Drop `public/moves/<slug>.webm` (and/or `.mp4`) + `public/moves/<slug>.jpg` poster, slug = the exercise slug in `src/lib/data/exercises.ts` (e.g. `back-squat`).
- Run `npm run moves` → `public/moves/manifest.json` is rebuilt.
- `MoveMedia` (`src/components/MoveMedia.tsx`) plays the loop everywhere (library, detail, session, Today, mobility flow); exercises without a file fall back to the procedural `MoveRig`. Muted, inline, plays only on screen, poster under reduced motion.

Generation spec (works with Higgsfield / Kling / Runway / Blender):

- **Subject:** grey clay anatomical mannequin, visible muscle striations, no face, no clothing details; working muscles (`primary` of the exercise) emissive red `#FF3B3B`, secondary a dimmer ember.
- **Camera:** ¾ front, slight low angle, 50 mm, fixed; subject centred, full body in frame with equipment.
- **Light/background:** single soft key from top-left, dark studio `#0A0A0A`, faint floor reflection, no props except the equipment (barbell, dumbbells, kettlebell, bench, bar).
- **Motion:** one full rep at the prescribed tempo, first and last frame identical → seamless loop; 3–4 s, 30 fps, 1080×1350 (4:5).
- **Export:** WebM (VP9, ~2 Mb/s) + MP4 (H.264) + JPG poster of frame 0.
- Prompt skeleton: `3D anatomical mannequin, grey clay body with muscle definition, performing a {exercise name} with {equipment}, {primary muscles} glowing red, studio black background, soft key light, three-quarter view, seamless loop, 4:5`.
