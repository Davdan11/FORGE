# FORGE — where things stand

Written so this work can continue on another machine, in another session,
without the conversation that produced it.

The code is on GitHub and clones cleanly. What does not clone is **why**
things are the way they are — the decisions, the things that were tried and
failed, and the traps that cost hours. That is what this file is for. Read it
before changing anything in the areas it covers.

---

## What FORGE is

A complete training app: a twelve-week plan that adapts, GPS activity
recording across 28 sports, nutrition, progression with ranks and rewards, a
social feed, and an indoor riding mode. Offline-first — everything lives in
IndexedDB and the app works with no network at all. Supabase is optional and
only carries sync and the social layer.

It ships three ways from one codebase: the web app, an iOS app and an Android
app, both through Capacitor.

---

## Running it

```bash
npm install
npm run dev            # web app on :3000
npm test               # 235 tests
```

Native:

```bash
npm run build:native   # static export + cap sync
npm run android        # opens Android Studio
npm run ios            # opens Xcode — macOS only
```

**On Windows:** everything works except the iOS app, which needs macOS and
Xcode. That is Apple's restriction, not ours. Android and web are unaffected.

---

## The architecture, in one page

- **Next.js 16 + React 19**, every page `"use client"`, **zero API routes**.
  That is what makes the static export possible, and the static export is what
  makes the native apps possible. Adding a server route breaks both.
- **Dexie / IndexedDB** for all app data, through `useLiveQuery`.
- **Supabase** for sync and the social layer, both optional. Without keys the
  app is fully usable and simply hides those features.
- **Three.js** for the indoor world, dynamically imported so its ~600 KB never
  reaches anyone who does not open that screen.
- **Capacitor** for the native shells.

### The engine lives in `src/lib`

| | |
|---|---|
| `engine/plan.ts` | Twelve-week block generation |
| `engine/injury.ts` | Training adapted around an injury |
| `engine/readiness.ts` | Daily check-in to session adjustment |
| `verify.ts` | Anti-cheat accounting for GPS activities |
| `analytics.ts` | Weekly series, lift trends, goal tracking |
| `indoor/ble-parse.ts` | Bluetooth sensor frame decoding |
| `indoor/physics.ts` | Effort to speed |
| `indoor/course.ts` | Course generation, from seed or from a real ride |
| `social/privacy.ts` | What may leave the device |

All of it is pure and tested. **That is deliberate** — the parts that can be
wrong in silence are the parts that are covered.

---

## Traps that cost real time. Do not re-learn these.

### Capacitor serves files, not directories

Ask the iOS scheme handler for `/onboarding/` and it returns a **blank
document** — no error, no 404. Any web server would have returned
`index.html`. The app sat on its splash screen forever.

`src/lib/native.ts` → `documentUrl()` names the file inside the shell. Only
**hard** navigations need it; links inside the app go through the Next client
router, which never asks the handler for a document.

Three theories were wrong before this was found: the service worker, the
variable font, and IndexedDB. **IndexedDB works fine in the WebView** — that
was proven by bisection, not assumed.

### Capacitor does not give the WebView Bluetooth

Wrapping a web app in a native shell does **not** hand it a Bluetooth API. A
WebView cannot reach CoreBluetooth; a plugin has to bridge it.
`src/lib/indoor/transport.ts` holds both paths behind one interface. Native is
necessary and **not sufficient** — that was assumed for a day and it was wrong.

### Safari has no Web Bluetooth, on any Apple device

Not a bug to work around in JavaScript. In the browser, sensors need Chrome on
Android, Mac or Windows. On iPhone they need the app.

### Tailwind v4 layer order

`globals.css` is wrapped in `@layer base` / `@layer components`. Unlayered CSS
beats every utility, which once produced 25 `!important`. `.text-volt` and
`.border-volt` are deliberately left **unlayered**; that is not an oversight.

### `useLiveQuery` returns `undefined` twice

It means both "still loading" and "not found". A guard that does not
distinguish them produces a skeleton that never resolves. Return `?? null` and
check for `null` explicitly.

### The service worker

Registered in production only, and **never** inside the native shell, where it
is redundant and actively harmful. See `src/components/PwaRegister.tsx`.

### Do not judge a screen from a screenshot

The simulator's WebView takes five to ten seconds to paint. Four separate
"it's broken" conclusions this session were premature screenshots. **Read the
DOM instead** — `document.body.innerText` settles the question in one call.

---

## Decisions worth keeping

**Three.js, not Unity.** Unity would look better and would cost the web
version of the indoor mode, 30–80 MB of app size, and a second build pipeline.
One codebase for three platforms was the requirement. If Three.js hits a
ceiling later, Unity is still available; the reverse is not true.

**Update 2026-09-22 — the indoor game moves to Unity.** The owner is building
the indoor world in Unity (`C:\Users\danjo\My project`, private repo
`github.com/Davdan11/FORGE-Unity.`; its `CLAUDE.md` has the plan). Decision:
Unity **native** inside this app on iPhone, iPad and Android (Unity as a
Library, opened by a Capacitor plugin) and **Unity Web** for a browser link;
one message protocol for both bridges. This app keeps Bluetooth, FTMS control,
accounts, XP, saving and multiplayer; Unity renders and runs the ride. XP is
never computed in Unity. The Three.js world stays as the fallback. Integration
waits until the owner says the game is ready.

**Stylised, not photoreal.** An approximation of a photoreal world looks cheap
beside the games people already play. Low-poly with flat colours reads as a
decision.

**Provenance travels with every number.** Effort is `measured`, `estimated` or
`declared`, and XP credit is 1, 0.6 and 0. Somebody with no hardware can ride
and watch the world move; they cannot climb a board by typing 400.

**Bots are never counted as people.** The indoor pacers are named as riders
and labelled as robots. A leaderboard with invented people on it is worthless
the day somebody notices.

**Published routes are trimmed.** The first and last 250 m of any shared route
are cut, and the "near you" cell comes from the **middle** of the trimmed
route. A live position is one moment; a published route is permanent and it
repeats, and its start point is a front door. See `src/lib/social/privacy.ts`
— 29 tests, written as the promise they make rather than as unit mechanics.

---

## Verified, and not

**Verified:** the web app end to end; the static export served over HTTP; the
iOS app booting, navigating, drawing MapLibre tiles and running the Three.js
world on a simulator; 235 tests.

**Not verified:**

- **No sensor has ever connected.** A simulator has no Bluetooth radio. The
  frame decoders are tested against the SIG specifications, not against
  hardware. The first real strap is the first real test.
- **The Android app has never been built.** The project exists; it needs
  Android Studio. This is a good first task on a Windows machine.
- **The SQL has never been executed.** `supabase/schema.sql` was read line by
  line and three errors were found that way, but reading is not running.
- **Nothing has run on a physical phone**, only on a simulator.

---

## Indoor: trainers and treadmills, the first hardware test

Control goes through the FTMS Control Point (`src/lib/indoor/ftms.ts`, bytes
tested against the spec, never against a machine). Slope mode sends the road's
grade at most once a second and only when it moved 0.5 %; ERG sends watts from
the workout or a slider. On a treadmill, incline and belt speed are **off by
default** and switched on by the runner.

With the first trainer (Wahoo KICKR, Tacx Neo/Flux, Elite Direto/Suito, Saris
H3, Zwift Hub — anything that advertises FTMS):

1. Close Zwift, the maker's app and anything else that might hold it: FTMS
   gives control to one app at a time. A refusal shows "Read-only" on screen.
2. Indoor → Ride → Free ride → Smart trainer. Expect "connected", then the
   power dial in green ("Measured power").
3. Ride La Montagne. The resistance must rise on the climbs within a second
   or two. If it never changes, the control point write is failing.
4. Switch to ERG, set 150 W, then 250 W. The trainer must hold the watts
   whatever the cadence.
5. Ride Sweet spot 3×10 for a few minutes: the target must change at each block.
6. End, save, and check the activity says "measured" and earned full XP.

Treadmill: same, with Run → Smart treadmill; turn on "Follow the hills" and
watch the incline follow the road (0–15 %). Belt speed from a workout moves
the belt by itself — test it standing on the side rails first.

---

## Legal and launch compliance (US first)

- **Privacy Policy and Terms** are at `/legal/privacy` and `/legal/terms`,
  written from what the code actually does. Fill in `LEGAL` in
  `src/lib/brand.ts` (company, address, email, date, governing law, the
  Supabase data region), have a lawyer read both, then set `draft: false` —
  until then both pages show a "Draft" banner. If the app starts collecting
  something new or sending it somewhere new, the policy changes in the same
  commit.
- **Consent**: onboarding requires ticking the health notice and the terms /
  health-data consent; both are timestamped on the profile.
- **Minimum age**: 13, or 16 when the phone's language region or time zone is
  in the EU/EEA/Switzerland (`minimumAge()` in brand.ts).
- **Account deletion** (required by Apple, Google and the GDPR): Settings →
  Delete account calls `delete_my_account()`. **Run
  `supabase/delete-account.sql` once in the SQL editor** — until then the
  button says deletion isn't available yet. Installed on the project on
  2026-09-22: an anonymous call now gets "permission denied for function
  delete_my_account" (it exists, and only signed-in users may call it). Not
  yet exercised end to end with a real signed-in account.
- The stores also need the policy at a **public URL**: host the web build, or
  paste the text into a public page.

---

## Open work

1. **Android build** — the project is generated and untested.
2. **Reward claiming** — built 2026-09-23. The owner creates gift campaigns
   at `/admin` (photo, rule, dates, stock, daily cap); athletes see them on
   the ranks page and claim with an address; each claim carries a training
   report with anti-cheat flags (`src/lib/rewards.ts`). The limits live in
   the database (`supabase/rewards.sql`: RLS, one claim each, stock and daily
   cap in a trigger), not in the app. **Run `supabase/rewards.sql` once**,
   after signing in with the owner's email, or `/admin` says "Admins only".
   Not yet exercised end to end with a real claim.
3. **Multiplayer presence** — built (`src/lib/indoor/live.ts`): one Realtime
   channel per course and sport, presence for who is there, a position
   broadcast once a second, extrapolated between messages. Signed-in only.
   Verified: two clients on the real project see each other's presence and
   receive each other's broadcast. Not verified: two phones riding together.
   The privacy rule holds: only a distance on a fictional road is sent, never
   GPS, and nothing is stored.
4. **3D assets** — see `public/models/README.md` for the contract, the budgets
   and the licence table. Start with **one** object and look at it before
   making fifty.
5. **Design pass** — the owner has flagged placement and polish across several
   screens, and specifically that the 1–5 rating controls repeated throughout
   the app do not feel premium. Screenshots pending.
6. **Week 13** — the twelve-week block ends at a cliff with nothing after it.
7. **`appId` is `ca.danjou.forge`** and becomes permanent at the first App
   Store submission. Change it to a domain you control first.

---

## Working agreement

Stated by the owner, and it holds: **no lazy work, and no inventing things.**
In practice that has meant saying plainly what was verified and what was not,
in commit messages and in conversation — including the wrong turns. Several
commits here record theories that turned out to be false, so nobody spends an
afternoon re-testing them.

---

## Unity game online (branch `unity-online`, 2026-09-23)

The Unity indoor game (repo FORGE-Unity) runs inside this app through Unity
Web: Indoor → "FORGE Ride · 3D world, online" → `components/indoor/UnityRide.tsx`.
The Unity Web build goes in `public/unity/` (ignored by git, ~40 MB). The app
keeps sensors, trainer control, XP, saving and the Realtime rooms
(`unity:<route key>`, `unity-event:<id>[:<race category>]`); pure logic and
tests in `lib/indoor/unity.ts`. The message contract is at the top of
ForgeBridge.cs in the Unity repo.

- **Race categories** A ≥ 4.0, B ≥ 3.2, C ≥ 2.5, D (FTP W/kg). Each rider's
  position broadcast carries their effort quality; only "measured" riders get
  the check mark in the game. **"Bravo"**: a `kudos` broadcast to one peer.
- **World segment boards**: **run `supabase/segments.sql` once** (table
  `segment_efforts` + `segment_board()`; measured only, own rows only,
  physically possible, 60/hour). Until then posting simply fails silently.
- **TCX export** (`lib/tcx.ts`): indoor rides keep one sample a second in
  `activity.streams`; the activity page offers "Export for Strava (TCX)".
  Automatic Strava upload needs a Strava API app + a server for OAuth (next).
- **Not verified**: two real accounts riding together, any real trainer.

### Indoor: any-brand trainer detection (2026-09-23)
One "Trainer" button (SensorKind "trainer") scans for FTMS 0x1826, Tacx FE-C
6e40fec1…, Cycling Power 0x1818, CSC 0x1816, then picks from the services
found: ftms > tacx-fec > wahoo-legacy (0x1818 + a026e005…) > power-only >
speed-only. Name → brand is display only. Callers use TrainerControl
(start/stop/setGrade/setTargetPower) from lib/indoor/trainer.ts; FTMS bytes
are unchanged. FE-C (fec.ts) is spec-tested only; Wahoo legacy (wahoo.ts)
comes from reverse-engineering notes — both UNVERIFIED on hardware. First
hardware tests: an old-firmware Tacx (FE-C) and a pre-FTMS KICKR (unlock/ERG/
grade). Speed-only trainers can pick a curve (Kinetic Road Machine is the only
published one; the generic fluid/magnetic curves are approximations).
UnityRide uses this; Ride.tsx still uses the FTMS-only path.
