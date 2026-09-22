"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { addDays, db, getProfile, getStats, resetAll, todayISO } from "@/lib/db";
import { goalLabel } from "@/lib/engine/plan";
import { PAIN_LABEL } from "@/lib/engine/readiness";
import { rebuildRemaining } from "@/lib/engine/rebuild";
import { levelFromXp, rankFor, subRankFor, tierForLevel } from "@/lib/gamification";
import { RankEmblem } from "@/components/RankEmblem";
import { supabase, isConfigured } from "@/lib/supabase/client";
import { accountLabel, restoreAccount, signOut } from "@/lib/auth";
import { AccountPanel } from "@/components/AccountPanel";
import { syncNow } from "@/lib/sync";
import { downloadBackup, restoreBackup } from "@/lib/backup";
import { IMG, sessionImage } from "@/lib/data/images";
import { fmtHeight, kgToLb, lbToKg } from "@/lib/units";
import { Screen, Hero, Section, Seg, MultiSeg, Toggle, Toast, Photo, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, Press } from "@/components/motion";
import { ensureNotificationPermission } from "@/lib/notify";
import { syncReminders } from "@/lib/remindersSync";
import { InjuryPanel } from "@/components/InjuryPanel";
import { AREAS, AVOID, DIETS, DEFAULT_LIFESTYLE, HOME_KIT, PLACES, SLEEP, STRESS, WORK, equipmentFor } from "@/lib/data/choices";
import { buildNutritionDay } from "@/lib/nutrition/engine";
import type { Goal, PainArea, Profile } from "@/lib/types";

const GOALS: { v: Goal; name: string; image: string }[] = [
  { v: "strength", name: "Get strong", image: sessionImage("lower", 400, 400) },
  { v: "build", name: "Build muscle", image: sessionImage("upper", 400, 400) },
  { v: "recomp", name: "Recomp", image: IMG.weight },
  { v: "cut", name: "Lose fat", image: sessionImage("cardio_intervals", 400, 400) },
  { v: "endurance", name: "Endurance", image: sessionImage("cardio_z2", 400, 400) },
  { v: "perform", name: "Perform", image: IMG.city },
];

export default function SettingsPage() {
  const router = useRouter();
  const profile = useLiveQuery(() => getProfile(), []);
  const stats = useLiveQuery(() => getStats(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    if (!isConfigured || !supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user ? accountLabel(data.user) : null));
  }, []);

  // Signing in here keeps what is on this phone and merges in the account.
  const onSignedIn = useCallback(async (u: User) => {
    setUser(accountLabel(u));
    const { message } = await restoreAccount().catch((e) => ({ message: e instanceof Error ? e.message : "Sync failed." }));
    setToast(message); setTimeout(() => setToast(null), 3500);
  }, []);

  if (!profile || !stats) return <ScreenSkeleton />;
  const lvl = levelFromXp(stats.xp);
  const imperial = profile.units.weight === "lb";
  // Profiles made before these existed: infer the place from the equipment.
  const place = profile.trainingPlace ?? (profile.equipment.includes("machine") ? "full_gym" : profile.equipment.some((e) => e !== "outdoor" && e !== "bodyweight") ? "home_gym" : "no_gym");
  const homeKit = profile.equipment.filter((e) => e !== "outdoor");
  const life = profile.lifestyle ?? DEFAULT_LIFESTYLE;
  const update = (patch: Partial<Profile>) => db.profile.update(profile.id, { ...patch, dirty: 1, updatedAt: new Date().toISOString() });

  /** Anything that changes the prescription rebuilds the remaining weeks. Done sessions stay. */
  /** A new diet or avoided food applies from today's menu on, not tomorrow's. */
  async function food(patch: Partial<Profile>) {
    await update(patch);
    const p = { ...profile!, ...patch };
    const today = todayISO();
    const session = await db.sessions.where("date").equals(today).first();
    const recent = (await db.nutrition.where("date").between(addDays(today, -3), addDays(today, -1), true, true).toArray()).flatMap((d) => d.meals.map((m) => m.mealId));
    const yesterday = await db.nutrition.get(addDays(today, -1));
    await db.nutrition.put({ ...buildNutritionDay(p, today, session ?? null, yesterday ?? undefined, recent), dirty: 1 });
    say("Today's menu rebuilt.");
  }

  async function rebuild(patch: Partial<Profile>, why: string) {
    await update(patch);
    await rebuildRemaining(patch);
    say(`Block rebuilt · ${why}.`);
  }

  return (
    <Page>
      <Screen>
        <Hero image={IMG.dark} height="h-[280px]" back="/progress" eyebrow={`Member since ${profile.createdAt.slice(0, 10)} · ${rankFor(lvl.level)}`} title={<>{profile.name}<br /><em>settings.</em></>}
          right={<span className="chip chip--live backdrop-blur-md">FORGE v0.6</span>} />

        <Stagger className="lg:grid lg:grid-cols-2 lg:gap-x-10 lg:items-start">
          <div className="min-w-0">
            <Item>
              <Section title="Profile">
                <div className="card p-4 grid gap-4">
                  <div className="flex items-center gap-4">
                    <Link href="/ranks" aria-label="Your rank"><RankEmblem tier={tierForLevel(lvl.level)} sub={subRankFor(lvl.level)} size={56} /></Link>
                    <label className="field flex-1"><span className="meta">Name</span><input className="input" defaultValue={profile.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== profile.name) { update({ name: v }); say("Saved."); } }} /></label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="field"><span className="meta">Weight ({imperial ? "lb" : "kg"})</span><input className="input tnum" inputMode="decimal" key={profile.units.weight} defaultValue={imperial ? Math.round(kgToLb(profile.weightKg)) : Math.round(profile.weightKg * 10) / 10} onBlur={(e) => { const v = Number(e.target.value); if (v) update({ weightKg: imperial ? lbToKg(v) : v }); }} /></label>
                    <label className="field"><span className="meta">Height</span><input className="input tnum" inputMode="decimal" key={`h-${profile.units}`} defaultValue={imperial ? Math.round(profile.heightCm / 2.54) : Math.round(profile.heightCm)} onBlur={(e) => { const v = Number(e.target.value); if (v) update({ heightCm: imperial ? v * 2.54 : v }); }} /></label>
                    <label className="field"><span className="meta">Age</span><input className="input tnum" inputMode="numeric" defaultValue={profile.age} onBlur={(e) => update({ age: Number(e.target.value) || profile.age })} /></label>
                  </div>
                  <p className="text-xs text-smoke">{fmtHeight(profile.heightCm, profile.units)} · {imperial ? `${Math.round(kgToLb(profile.weightKg))} lb` : `${Math.round(profile.weightKg * 10) / 10} kg`} · calories and loads follow these.</p>
                </div>
              </Section>
            </Item>

            <Item>
              <Section title="Training" aside={<span className="text-xs text-smoke">changes rebuild the remaining weeks</span>}>
                <div className="card p-4 grid gap-5">
                  <div className="field">
                    <span className="meta">Goal · {goalLabel(profile.goal)}</span>
                    <div className="grid grid-cols-3 gap-2">
                      {GOALS.map((g) => (
                        <button key={g.v} type="button" aria-pressed={profile.goal === g.v} onClick={() => profile.goal !== g.v && rebuild({ goal: g.v }, goalLabel(g.v))} className={`relative h-20 rounded-2xl overflow-hidden border text-left transition-colors ${profile.goal === g.v ? "border-volt" : "border-line"}`}>
                          <Photo src={g.image} veil className="absolute inset-0" />
                          <span className="on-photo absolute inset-x-0 bottom-0 p-2.5 text-xs font-medium leading-tight">{g.name}</span>
                          {profile.goal === g.v && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-volt" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="field"><span className="meta">Sessions / week</span><Seg fill value={profile.daysPerWeek} onChange={(d) => rebuild({ daysPerWeek: d }, `${d} days a week`)} options={[2, 3, 4, 5, 6].map((d) => ({ v: d as Profile["daysPerWeek"], label: String(d) }))} /></div>
                    <div className="field"><span className="meta">Minutes</span><Seg fill value={profile.sessionMinutes} onChange={(m) => rebuild({ sessionMinutes: m }, `${m}-minute sessions`)} options={[25, 40, 60, 75].map((m) => ({ v: m as Profile["sessionMinutes"], label: String(m) }))} /></div>
                  </div>
                  <div className="field">
                    <span className="meta">Where you train</span>
                    <Seg fill value={place} onChange={(v) => rebuild({ trainingPlace: v, equipment: equipmentFor(v, homeKit) }, PLACES.find((x) => x.v === v)!.name.toLowerCase())} options={PLACES.map((x) => ({ v: x.v, label: x.name }))} />
                  </div>
                  {place === "home_gym" && <div className="field"><span className="meta">In your home gym</span><MultiSeg value={homeKit} onChange={(kit) => rebuild({ equipment: equipmentFor("home_gym", kit) }, "home gym updated")} options={HOME_KIT} /></div>}
                  <div className="field"><span className="meta">Old injuries · healed</span><MultiSeg value={profile.injuryHistory ?? []} onChange={(injuryHistory) => rebuild({ injuryHistory }, "old injuries noted")} options={AREAS} /><span className="text-xs text-smoke">Not excluded — the gentler version of each movement comes first.</span></div>
                  <div className="field"><span className="meta">Pain flags · clear when healed</span><MultiSeg value={profile.pain} onChange={(pain) => update({ pain })} options={(Object.keys(PAIN_LABEL) as PainArea[]).map((k) => ({ v: k, label: PAIN_LABEL[k] }))} /></div>
                </div>
              </Section>
            </Item>
            <Item>
              <Section title="Recovery" aside={<span className="text-xs text-smoke">sets volume and food</span>}>
                <div className="card p-4 grid gap-4">
                  <div className="field"><span className="meta">Sleep on a normal night</span><Seg fill value={life.sleep} onChange={(sleep) => rebuild({ lifestyle: { ...life, sleep } }, "recovery updated")} options={SLEEP} /></div>
                  <div className="field"><span className="meta">Stress these days</span><Seg fill value={life.stress} onChange={(stress) => rebuild({ lifestyle: { ...life, stress } }, "recovery updated")} options={STRESS} /></div>
                  <div className="field"><span className="meta">Your days are mostly</span><Seg fill value={life.work} onChange={(work) => rebuild({ lifestyle: { ...life, work } }, "recovery updated")} options={WORK} /></div>
                </div>
              </Section>
            </Item>
          </div>

          <div className="min-w-0">
            <Item>
              <Section title="Preferences">
                <div className="card divide-y divide-line">
                  <div className="p-4 grid gap-3">
                    <div><p className="text-sm font-medium">Food</p><p className="text-xs text-smoke">Changes rebuild today’s menu.</p></div>
                    <div className="field"><span className="meta">Way of eating</span><MultiSeg value={profile.dietary} onChange={(dietary) => food({ dietary })} options={DIETS} /></div>
                    <div className="field"><span className="meta">Foods you don’t eat</span><MultiSeg value={profile.avoidFoods ?? []} onChange={(avoidFoods) => food({ avoidFoods })} options={AVOID} /></div>
                  </div>
                  <div className="p-4 grid gap-3">
                    <div><p className="text-sm font-medium">Units</p><p className="text-xs text-smoke">Body weight and distance are set separately — plenty of places weigh in pounds and run in kilometres.</p></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="field"><span className="meta">Body weight &amp; loads</span><Seg fill value={profile.units.weight} onChange={(weight) => update({ units: { ...profile.units, weight } })} options={[{ v: "kg", label: "kg" }, { v: "lb", label: "lb" }]} /></div>
                      <div className="field"><span className="meta">Distance &amp; pace</span><Seg fill value={profile.units.distance} onChange={(distance) => update({ units: { ...profile.units, distance } })} options={[{ v: "km", label: "km" }, { v: "mi", label: "mi" }]} /></div>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Reminders</p><p className="text-xs text-smoke">Morning check-in, an hour before each session, and meals. Arrives with the app closed.</p></div><Toggle on={profile.notifications} label="Reminders" onChange={async (v) => { if (v) { const p = await ensureNotificationPermission(); if (p !== "granted") { say(p === "denied" ? "Notifications are off for FORGE. Turn them on in your phone's settings." : "Notifications aren’t supported here."); return; } } await update({ notifications: v }); await syncReminders(); say(v ? "Reminders on." : "Reminders off."); }} /></div>
                  <div className="p-4 grid gap-3"><div><p className="text-sm font-medium">Timing</p><p className="text-xs text-smoke">Meals are placed around these.</p></div><div className="grid grid-cols-2 gap-3"><label className="field"><span className="meta">Training</span><input className="input" type="time" value={profile.trainTime} onChange={(e) => update({ trainTime: e.target.value })} /></label><label className="field"><span className="meta">Wake</span><input className="input" type="time" value={profile.wakeTime} onChange={(e) => update({ wakeTime: e.target.value })} /></label></div></div>
                  <div className="p-4 flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Meals per day</p><p className="text-xs text-smoke">Tomorrow’s menu follows.</p></div><Seg fill value={profile.mealsPerDay} onChange={(m) => update({ mealsPerDay: m })} options={[3, 4, 5].map((m) => ({ v: m as Profile["mealsPerDay"], label: String(m) }))} /></div>
                </div>
              </Section>
            </Item>

            <Item>
              <InjuryPanel onSay={say} />
            </Item>

            <Item>
              <Section title="Account">
                {!isConfigured ? (
                  <div className="card p-4 grid gap-1"><p className="text-sm font-medium">On this device</p><p className="text-xs text-smoke">Your plan, sessions, routes and meals are stored locally and work offline. No account is set up on this build, so export a copy below to keep your block safe.</p></div>
                ) : user ? (
                  <div className="card p-4 grid gap-3"><p className="text-sm">Signed in as <strong>{user}</strong></p><div className="flex gap-2"><Press><button type="button" className="pill pill--sm pill--bone" onClick={async () => say(await syncNow())}>Sync now</button></Press><button type="button" className="pill pill--sm" onClick={async () => { await signOut(); setUser(null); }}>Sign out</button></div></div>
                ) : (
                  <div className="card p-4 grid gap-3"><p className="text-sm">Create an account or sign in to back up your training and use it on every device. What is on this phone is kept.</p><AccountPanel onSignedIn={onSignedIn} compact /></div>
                )}
              </Section>
            </Item>

            <Item>
              <Section title="Backup">
                <div className="card p-4 grid gap-3">
                  <p className="text-sm">Everything you log lives on this device. Export a copy you keep — it works with no account and no network, and it is the only way to move your block to a browser that can’t sign in.</p>
                  <div className="flex gap-2 flex-wrap">
                    <Press><button type="button" className="pill pill--sm pill--bone" onClick={async () => { try { say(await downloadBackup()); } catch { say("Export failed."); } }}>Export a copy</button></Press>
                    <Press><button type="button" className="pill pill--sm" onClick={() => fileRef.current?.click()}>Restore from file</button></Press>
                  </div>
                  <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; e.target.value = "";
                    if (!file) return;
                    if (!confirm("Replace everything on this device with the contents of this backup?")) return;
                    try { say(await restoreBackup(await file.text())); router.refresh(); }
                    catch (err) { say(err instanceof Error ? err.message : "Restore failed."); }
                  }} />
                </div>
              </Section>
            </Item>

            <Item>
              <Section title="Danger zone">
                <div className="card p-4 flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Reset this device</p><p className="text-xs text-smoke">Deletes profile, block, logs, routes and meals here. Cannot be undone.</p></div><button type="button" className="pill pill--danger pill--sm shrink-0" onClick={async () => { if (confirm("Delete everything on this device?")) { await resetAll(); router.replace("/onboarding"); } }}>Reset</button></div>
              </Section>
            </Item>
            <Item><p className="text-xs text-smoke">FORGE v0.6 · free, worldwide · offline-first · {stats.xp.toLocaleString("en-US")} XP on this device</p></Item>
          </div>
        </Stagger>
        <Toast text={toast} />
      </Screen>
    </Page>
  );
}
