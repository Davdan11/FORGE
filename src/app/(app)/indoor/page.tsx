"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Users } from "lucide-react";
import { db, getProfile } from "@/lib/db";
import { guessFtp } from "@/lib/indoor/physics";
import { Screen, Hero, Section, ScreenSkeleton, Toast } from "@/components/ui";
import { ART } from "@/lib/data/images";
import { Page, Press } from "@/components/motion";
import { UnityRide } from "@/components/indoor/UnityRide";
import type { Profile as AthleteProfile } from "@/lib/types";

/* Indoor is the FORGE Ride game (Unity). The game picks the route and the
   workout; the app reads the sensors, keeps the FTP, counts the XP and saves
   the ride (see UnityRide). The Three.js ride (components/indoor/Ride.tsx)
   stays in the code as a fallback but is no longer offered here. */

/** The game's routes, as listed in its catalog (RideRouteCatalog.cs). */
const ROUTES = [
  { name: "Polders", country: "Netherlands", km: 20, level: "Beginner", about: "Flatlands, canals and windmills" },
  { name: "Sakura Valley", country: "Japan", km: 20, level: "Beginner +", about: "Gentle valley and red gates" },
  { name: "Provence", country: "France", km: 40, level: "Intermediate", about: "Short hills and lavender fields" },
  { name: "Tuscan Hills", country: "Italy", km: 40, level: "Athletic", about: "Vineyards and rolling hills" },
  { name: "Alpine Pass", country: "Switzerland", km: 60, level: "Advanced", about: "Long climbs and alpine valleys" },
  { name: "Pine Ridge", country: "Canada", km: 100, level: "Expert", about: "The original mountain Grand Tour" },
  { name: "Montalcino Wall", country: "Italy", km: 8, level: "Challenge · climb", about: "The road rears up to the summit" },
  { name: "Polders Criterium", country: "Netherlands", km: 12, level: "Challenge · sprint", about: "Dead flat, two timed sprints" },
  { name: "Giant's Pass", country: "Switzerland", km: 25, level: "Challenge · HC", about: "1,400 m of climbing at 7%" },
];

export default function IndoorPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3400); };

  if (!profile) return <ScreenSkeleton />;
  const ftpW = profile.ftpW ?? guessFtp(profile.weightKg, profile.level);

  if (playing) {
    return (
      <Page>
        <UnityRide profile={profile} ftpW={ftpW} say={say} onExit={(msg) => { setPlaying(false); if (msg) say(msg); }} />
        <Toast text={toast} />
      </Page>
    );
  }

  return (
    <Page>
      <Screen>
        <Hero image={ART.indoor} color height="h-[340px]" eyebrow="Indoor · FORGE Ride"
          title={<>Ride the world<br /><em>from your basement.</em></>}>
          <p className="text-sm text-bone/80 max-w-[48ch]">
            A 3D world, online. Group rides every 30 minutes, drafting, medals — and a smart trainer makes you feel every climb.
          </p>
        </Hero>

        <Press className="block mb-8">
          <button type="button" onClick={() => setPlaying(true)} className="pill pill--volt pill--block pill--lg">Start FORGE Ride</button>
        </Press>

        <Section title="The routes" aside={<span className="text-xs text-smoke">choose in the game</span>}>
          <div className="grid gap-2">
            {ROUTES.map((r) => (
              <div key={r.name} className="card p-4 flex items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="block font-semibold truncate">{r.name}</span>
                  <span className="block text-xs text-smoke mt-0.5">{r.country} · {r.about}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block font-semibold tnum">{r.km} km</span>
                  <span className="block text-[11px] text-smoke">{r.level}</span>
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Your power">
          <Ftp ftpW={ftpW} tested={profile.ftpW != null} onChange={(ftp) => db.profile.update(profile.id, { ftpW: ftp, dirty: 1, updatedAt: new Date().toISOString() } as Partial<AthleteProfile>)} />
        </Section>

        <div className="card p-4 flex items-start gap-3 text-sm">
          <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-graphite text-smoke"><Users className="w-4 h-4" strokeWidth={2} /></span>
          <span className="text-smoke">Sign in to ride with others: everyone on the same road appears in your world. Measured power earns full XP, heart rate 60 %.</span>
        </div>
      </Screen>
      <Toast text={toast} />
    </Page>
  );
}

/** FTP: guessed from level until the athlete enters a real one. The game sets its targets from it. */
function Ftp({ ftpW, tested, onChange }: { ftpW: number; tested: boolean; onChange: (ftp: number) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(ftpW));
  return (
    <div className="text-sm text-smoke">
      {!open ? (
        <p>
          Workout targets use an FTP of <strong className="text-ink tnum">{ftpW} W</strong>{tested ? "" : ", guessed from your level"}.{" "}
          <button type="button" className="underline" onClick={() => { setV(String(ftpW)); setOpen(true); }}>Change</button>
        </p>
      ) : (
        <form className="flex items-center gap-2" onSubmit={(e) => {
          e.preventDefault();
          const n = parseFloat(v);
          if (n >= 50 && n <= 600) onChange(Math.round(n));
          setOpen(false);
        }}>
          <input className="input !h-9 w-24 tnum" type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
          <span>W</span>
          <button type="submit" className="pill pill--sm">Save</button>
        </form>
      )}
    </div>
  );
}
