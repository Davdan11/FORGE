"use client";

import { APP_NAME, HEALTH_NOTICE } from "@/lib/brand";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { langChoice, locale, setLang, useLang, useT, type LangChoice } from "@/lib/i18n";
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
import { accountLabel, deleteAccount, restoreAccount, signOut } from "@/lib/auth";
import { AccountPanel } from "@/components/AccountPanel";
import { amAdmin } from "@/lib/rewards";
import { syncNow } from "@/lib/sync";
import { readSyncStatus } from "@/lib/autosync";
import { downloadBackup, restoreBackup } from "@/lib/backup";
import { IMG, sessionImage } from "@/lib/data/images";
import { fmtHeight, kgToLb, lbToKg } from "@/lib/units";
import { Screen, Hero, Section, RadioField, RadioCards, MultiSeg, Toggle, Toast, Photo, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, Press } from "@/components/motion";
import { ensureNotificationPermission } from "@/lib/notify";
import { syncReminders } from "@/lib/remindersSync";
import { InjuryPanel } from "@/components/InjuryPanel";
import { AREAS, AVOID, DIETS, DEFAULT_LIFESTYLE, HOME_KIT, PLACES, SLEEP, STRESS, WORK, equipmentFor, choiceOptions, choiceLabel, placeText } from "@/lib/data/choices";
import { buildNutritionDay } from "@/lib/nutrition/engine";
import type { Goal, PainArea, Profile } from "@/lib/types";

const GOALS: { v: Goal; name: { fr: string; en: string }; image: string }[] = [
  { v: "strength", name: { fr: "Devenir fort", en: "Get strong" }, image: sessionImage("lower", 400, 400) },
  { v: "build", name: { fr: "Prendre du muscle", en: "Build muscle" }, image: sessionImage("upper", 400, 400) },
  { v: "recomp", name: { fr: "Recomposition", en: "Recomp" }, image: IMG.weight },
  { v: "cut", name: { fr: "Perdre du gras", en: "Lose fat" }, image: sessionImage("cardio_intervals", 400, 400) },
  { v: "endurance", name: { fr: "Endurance", en: "Endurance" }, image: sessionImage("cardio_z2", 400, 400) },
  { v: "perform", name: { fr: "Performance", en: "Perform" }, image: IMG.city },
];

/* The stored language choice, read on the client only: the server render and
   the first client render both say "auto", then the real choice follows. */
const LANG_EVENT = "forge:lang"; // the event setLang() fires (src/lib/i18n.ts)
function subscribeLang(cb: () => void) {
  window.addEventListener(LANG_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(LANG_EVENT, cb); window.removeEventListener("storage", cb); };
}
function useLangChoice(): LangChoice {
  return useSyncExternalStore<LangChoice>(subscribeLang, langChoice, () => "auto");
}

export default function SettingsPage() {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const choice = useLangChoice();
  const profile = useLiveQuery(() => getProfile(), []);
  const stats = useLiveQuery(() => getStats(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    if (!isConfigured || !supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user ? accountLabel(data.user) : null));
  }, []);

  // Signing in here keeps what is on this phone and merges in the account.
  const onSignedIn = useCallback(async (u: User) => {
    setUser(accountLabel(u));
    const { message } = await restoreAccount().catch((e) => ({ message: e instanceof Error ? e.message : (lang === "fr" ? "La synchro a échoué." : "Sync failed.") }));
    setToast(message); setTimeout(() => setToast(null), 3500);
  }, [lang]);

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
    say(t("Menu du jour refait.", "Today's menu rebuilt."));
  }

  async function rebuild(patch: Partial<Profile>, why: string) {
    await update(patch);
    await rebuildRemaining(patch);
    say(t(`Bloc refait · ${why}.`, `Block rebuilt · ${why}.`));
  }

  return (
    <Page>
      <Screen>
        <Hero image={IMG.dark} height="h-[280px]" back="/progress" eyebrow={`${t("Membre depuis le", "Member since")} ${new Date(profile.createdAt).toLocaleDateString(locale(), { year: "numeric", month: "long", day: "numeric" })} · ${rankFor(lvl.level, lang)}`} title={<>{profile.name}<br /><em>{t("réglages.", "settings.")}</em></>}
          right={<span className="chip chip--live backdrop-blur-md">{APP_NAME} v0.6</span>} />

        <Stagger className="lg:grid lg:grid-cols-2 lg:gap-x-10 lg:items-start">
          <div className="min-w-0">
            <Item>
              <Section title={t("Langue", "Language")}>
                <div className="card p-4 grid gap-2">
                  <RadioField<LangChoice>
                    label="Langue / Language"
                    value={choice}
                    onChange={(c) => setLang(c)}
                    options={[
                      { v: "auto", label: t("Automatique (langue du téléphone)", "Automatic (phone language)") },
                      { v: "fr", label: "Français" },
                      { v: "en", label: "English" },
                    ]}
                  />
                </div>
              </Section>
            </Item>

            <Item>
              <Section title={t("Profil", "Profile")}>
                <div className="card p-4 grid gap-4">
                  <div className="flex items-center gap-4">
                    <Link href="/ranks" aria-label={t("Ton rang", "Your rank")}><RankEmblem tier={tierForLevel(lvl.level)} sub={subRankFor(lvl.level)} size={56} /></Link>
                    <label className="field flex-1"><span className="meta">{t("Nom", "Name")}</span><input className="input" defaultValue={profile.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== profile.name) { update({ name: v }); say(t("Enregistré.", "Saved.")); } }} /></label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="field"><span className="meta">{t("Poids", "Weight")} ({imperial ? "lb" : "kg"})</span><input className="input tnum" inputMode="decimal" key={profile.units.weight} defaultValue={imperial ? Math.round(kgToLb(profile.weightKg)) : Math.round(profile.weightKg * 10) / 10} onBlur={(e) => { const v = Number(e.target.value); if (v) update({ weightKg: imperial ? lbToKg(v) : v }); }} /></label>
                    <label className="field"><span className="meta">{t("Taille", "Height")}</span><input className="input tnum" inputMode="decimal" key={`h-${profile.units}`} defaultValue={imperial ? Math.round(profile.heightCm / 2.54) : Math.round(profile.heightCm)} onBlur={(e) => { const v = Number(e.target.value); if (v) update({ heightCm: imperial ? v * 2.54 : v }); }} /></label>
                    <label className="field"><span className="meta">{t("Âge", "Age")}</span><input className="input tnum" inputMode="numeric" defaultValue={profile.age} onBlur={(e) => update({ age: Number(e.target.value) || profile.age })} /></label>
                  </div>
                  <p className="text-xs text-smoke">{fmtHeight(profile.heightCm, profile.units)} · {imperial ? `${Math.round(kgToLb(profile.weightKg))} lb` : `${Math.round(profile.weightKg * 10) / 10} kg`} · {t("les calories et les charges suivent ces valeurs.", "calories and loads follow these.")}</p>
                </div>
              </Section>
            </Item>

            <Item>
              <Section title={t("Entraînement", "Training")} aside={<span className="text-xs text-smoke">{t("tout changement refait les semaines restantes", "changes rebuild the remaining weeks")}</span>}>
                <div className="card p-4 grid gap-5">
                  <div className="field">
                    <span className="meta">{t("Objectif", "Goal")} · {goalLabel(profile.goal)}</span>
                    <div className="grid grid-cols-3 gap-2">
                      {GOALS.map((g) => (
                        <button key={g.v} type="button" aria-pressed={profile.goal === g.v} onClick={() => profile.goal !== g.v && rebuild({ goal: g.v }, goalLabel(g.v))} className={`relative h-20 rounded-2xl overflow-hidden border text-left transition-colors ${profile.goal === g.v ? "border-volt" : "border-line"}`}>
                          <Photo src={g.image} veil className="absolute inset-0" />
                          <span className="on-photo absolute inset-x-0 bottom-0 p-2.5 text-xs font-medium leading-tight">{t(g.name.fr, g.name.en)}</span>
                          {profile.goal === g.v && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-volt" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <RadioField label={t("Séances / semaine", "Sessions / week")} value={profile.daysPerWeek} onChange={(d) => rebuild({ daysPerWeek: d }, t(`${d} jours par semaine`, `${d} days a week`))} options={[2, 3, 4, 5, 6].map((d) => ({ v: d as Profile["daysPerWeek"], label: String(d) }))} />
                    <RadioField label="Minutes" value={profile.sessionMinutes} onChange={(m) => rebuild({ sessionMinutes: m }, t(`séances de ${m} minutes`, `${m}-minute sessions`))} options={[25, 40, 60, 75].map((m) => ({ v: m as Profile["sessionMinutes"], label: String(m) }))} />
                  </div>
                  <RadioField label={t("Où tu t’entraînes", "Where you train")} value={place} onChange={(v) => rebuild({ trainingPlace: v, equipment: equipmentFor(v, homeKit) }, placeText(PLACES.find((x) => x.v === v)!, lang).name.toLowerCase())} options={PLACES.map((x) => ({ v: x.v, label: placeText(x, lang).name }))} />
                  {place === "home_gym" && <div className="field"><span className="meta">{t("Dans ton gym maison", "In your home gym")}</span><MultiSeg value={homeKit} onChange={(kit) => rebuild({ equipment: equipmentFor("home_gym", kit) }, t("gym maison mis à jour", "home gym updated"))} options={choiceOptions(HOME_KIT, lang)} /></div>}
                  <div className="field"><span className="meta">{t("Anciennes blessures · guéries", "Old injuries · healed")}</span><MultiSeg value={profile.injuryHistory ?? []} onChange={(injuryHistory) => rebuild({ injuryHistory }, t("anciennes blessures notées", "old injuries noted"))} options={choiceOptions(AREAS, lang)} /><span className="text-xs text-smoke">{t("Pas exclus — la version la plus douce de chaque mouvement passe en premier.", "Not excluded — the gentler version of each movement comes first.")}</span></div>
                  <div className="field"><span className="meta">{t("Douleurs signalées · à retirer une fois guéri", "Pain flags · clear when healed")}</span><MultiSeg value={profile.pain} onChange={(pain) => update({ pain })} options={(Object.keys(PAIN_LABEL) as PainArea[]).map((k) => ({ v: k, label: PAIN_LABEL[k] }))} /></div>
                </div>
              </Section>
            </Item>
            <Item>
              <Section title={t("Récupération", "Recovery")} aside={<span className="text-xs text-smoke">{t("ajuste le volume et la bouffe", "sets volume and food")}</span>}>
                <div className="card p-4 grid gap-4">
                  <RadioField label={t("Sommeil une nuit normale", "Sleep on a normal night")} value={life.sleep} onChange={(sleep) => rebuild({ lifestyle: { ...life, sleep } }, t("récupération mise à jour", "recovery updated"))} options={choiceOptions(SLEEP, lang)} />
                  <RadioField label={t("Stress ces temps-ci", "Stress these days")} value={life.stress} onChange={(stress) => rebuild({ lifestyle: { ...life, stress } }, t("récupération mise à jour", "recovery updated"))} options={choiceOptions(STRESS, lang)} />
                  <RadioField label={t("Tes journées sont surtout", "Your days are mostly")} value={life.work} onChange={(work) => rebuild({ lifestyle: { ...life, work } }, t("récupération mise à jour", "recovery updated"))} options={choiceOptions(WORK, lang)} />
                </div>
              </Section>
            </Item>
          </div>

          <div className="min-w-0">
            <Item>
              <Section title={t("Préférences", "Preferences")}>
                <div className="card divide-y divide-line">
                  <div className="p-4 grid gap-3">
                    <div><p className="text-sm font-medium">{t("Alimentation", "Food")}</p><p className="text-xs text-smoke">{t("Tout changement refait le menu du jour.", "Changes rebuild today’s menu.")}</p></div>
                    <div className="field"><span className="meta">{t("Façon de manger", "Way of eating")}</span><MultiSeg value={profile.dietary} onChange={(dietary) => food({ dietary })} options={choiceOptions(DIETS, lang)} /></div>
                    <div className="field"><span className="meta">{t("Aliments que tu ne manges pas", "Foods you don’t eat")}</span><MultiSeg value={profile.avoidFoods ?? []} onChange={(avoidFoods) => food({ avoidFoods })} options={choiceOptions(AVOID, lang)} /></div>
                  </div>
                  <div className="p-4 grid gap-3">
                    <div><p className="text-sm font-medium">{t("Unités", "Units")}</p><p className="text-xs text-smoke">{t("Le poids et la distance se règlent séparément — plein de monde se pèse en livres et court en kilomètres.", "Body weight and distance are set separately — plenty of people weigh in pounds and run in kilometers.")}</p></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <RadioField label={t("Poids corporel et charges", "Body weight & loads")} value={profile.units.weight} onChange={(weight) => update({ units: { ...profile.units, weight } })} options={[{ v: "kg", label: "kg" }, { v: "lb", label: "lb" }]} />
                      <RadioField label={t("Distance et allure", "Distance & pace")} value={profile.units.distance} onChange={(distance) => update({ units: { ...profile.units, distance } })} options={[{ v: "km", label: "km" }, { v: "mi", label: "mi" }]} />
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between gap-4"><div><p className="text-sm font-medium">{t("Rappels", "Reminders")}</p><p className="text-xs text-smoke">{t("Bilan du matin, une heure avant chaque séance, et les repas. Arrive même quand l’app est fermée.", "Morning check-in, an hour before each session, and meals. Arrives with the app closed.")}</p></div><Toggle on={profile.notifications} label={t("Rappels", "Reminders")} onChange={async (v) => { if (v) { const p = await ensureNotificationPermission(); if (p !== "granted") { say(p === "denied" ? t(`Les notifications sont désactivées pour ${APP_NAME}. Active-les dans les réglages de ton téléphone.`, "Notifications are off for FORGE. Turn them on in your phone's settings.") : t("Les notifications ne sont pas prises en charge ici.", "Notifications aren’t supported here.")); return; } } await update({ notifications: v }); await syncReminders(); say(v ? t("Rappels activés.", "Reminders on.") : t("Rappels désactivés.", "Reminders off.")); }} /></div>
                  <div className="p-4 grid gap-3"><div><p className="text-sm font-medium">{t("Horaire", "Timing")}</p><p className="text-xs text-smoke">{t("Les repas sont placés autour de ces heures.", "Meals are placed around these.")}</p></div><div className="grid grid-cols-2 gap-3"><label className="field"><span className="meta">{t("Entraînement", "Training")}</span><input className="input" type="time" value={profile.trainTime} onChange={(e) => update({ trainTime: e.target.value })} /></label><label className="field"><span className="meta">{t("Réveil", "Wake")}</span><input className="input" type="time" value={profile.wakeTime} onChange={(e) => update({ wakeTime: e.target.value })} /></label></div></div>
                  <div className="p-4 flex items-center justify-between gap-4"><div><p className="text-sm font-medium">{t("Repas par jour", "Meals per day")}</p><p className="text-xs text-smoke">{t("Le menu de demain suivra.", "Tomorrow’s menu follows.")}</p></div><RadioCards label={t("Repas par jour", "Meals per day")} value={profile.mealsPerDay} onChange={(m) => update({ mealsPerDay: m })} options={[3, 4, 5].map((m) => ({ v: m as Profile["mealsPerDay"], label: String(m) }))} /></div>
                </div>
              </Section>
            </Item>

            <Item>
              <InjuryPanel onSay={say} />
            </Item>

            <Item>
              <Section title={t("Compte", "Account")}>
                {!isConfigured ? (
                  <div className="card p-4 grid gap-1"><p className="text-sm font-medium">{t("Sur cet appareil", "On this device")}</p><p className="text-xs text-smoke">{t("Ton plan, tes séances, tes parcours et tes repas sont stockés ici et fonctionnent hors ligne. Aucun compte n’est configuré dans cette version : exporte une copie plus bas pour garder ton bloc en sécurité.", "Your plan, sessions, routes and meals are stored locally and work offline. No account is set up on this build, so export a copy below to keep your block safe.")}</p></div>
                ) : user ? (
                  <div className="card p-4 grid gap-3"><div className="grid gap-0.5"><p className="text-sm">{t("Connecté en tant que", "Signed in as")} <strong>{user}</strong></p><SyncLine /></div><div className="flex gap-2"><Press><button type="button" className="pill pill--sm pill--bone" onClick={async () => say(await syncNow())}>{t("Synchroniser", "Sync now")}</button></Press><button type="button" className="pill pill--sm" onClick={async () => { await signOut(); setUser(null); }}>{t("Se déconnecter", "Sign out")}</button></div></div>
                ) : (
                  <div className="card p-4 grid gap-3"><p className="text-sm">{t("Crée un compte ou connecte-toi pour sauvegarder ton entraînement et l’utiliser sur tous tes appareils. Ce qui est sur ce téléphone est conservé.", "Create an account or sign in to back up your training and use it on every device. What is on this phone is kept.")}</p><AccountPanel onSignedIn={onSignedIn} compact /></div>
                )}
              </Section>
            </Item>

            <Item>
              <Section title={t("Sauvegarde", "Backup")}>
                <div className="card p-4 grid gap-3">
                  <p className="text-sm">{t("Tes données vivent sur ce téléphone. Exporte une copie pour les garder en sécurité — ça marche sans compte et sans internet.", "Your data lives on this phone. Export a copy to keep it safe — it works with no account and no internet.")}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Press><button type="button" className="pill pill--sm pill--bone" onClick={async () => { try { say(await downloadBackup()); } catch { say(t("L’exportation a échoué.", "Export failed.")); } }}>{t("Exporter une copie", "Export a copy")}</button></Press>
                    <Press><button type="button" className="pill pill--sm" onClick={() => fileRef.current?.click()}>{t("Restaurer depuis un fichier", "Restore from file")}</button></Press>
                  </div>
                  <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; e.target.value = "";
                    if (!file) return;
                    if (!confirm(t("Remplacer tout ce qu’il y a sur cet appareil par le contenu de cette sauvegarde?", "Replace everything on this device with the contents of this backup?"))) return;
                    try { say(await restoreBackup(await file.text())); router.refresh(); }
                    catch (err) { say(err instanceof Error ? err.message : t("La restauration a échoué.", "Restore failed.")); }
                  }} />
                </div>
              </Section>
            </Item>

            <Item>
              <Section title={t("Zone de danger", "Danger zone")}>
                <div className="card p-4 flex items-center justify-between gap-4"><div><p className="text-sm font-medium">{t("Réinitialiser cet appareil", "Reset this device")}</p><p className="text-xs text-smoke">{t("Supprime ici le profil, le bloc, les journaux, les parcours et les repas. Impossible à annuler.", "Deletes profile, block, logs, routes and meals here. Cannot be undone.")}</p></div><button type="button" className="pill pill--danger pill--sm shrink-0" onClick={async () => { if (confirm(t("Tout supprimer sur cet appareil?", "Delete everything on this device?"))) { await resetAll(); router.replace("/onboarding"); } }}>{t("Réinitialiser", "Reset")}</button></div>
                {user && (
                  <div className="card p-4 mt-2 flex items-center justify-between gap-4">
                    <div><p className="text-sm font-medium">{t("Supprimer le compte", "Delete account")}</p><p className="text-xs text-smoke">{t("Supprime ton compte et tout ce qui y est sauvegardé — plan, entraînements, activités, publications — sur tous tes appareils. Impossible à annuler.", "Deletes your account and everything saved with it — plan, workouts, activities, posts — on every device. Cannot be undone.")}</p></div>
                    <button type="button" className="pill pill--danger pill--sm shrink-0" onClick={async () => {
                      if (prompt(t("Tape DELETE pour supprimer ton compte et toutes ses données.", "Type DELETE to delete your account and all its data.")) !== "DELETE") return;
                      const err = await deleteAccount();
                      if (err) { say(err); return; }
                      await resetAll();
                      router.replace("/onboarding");
                    }}>{t("Supprimer", "Delete")}</button>
                  </div>
                )}
              </Section>
            </Item>
            <Item><p className="text-xs text-smoke leading-relaxed mb-2">{HEALTH_NOTICE[lang]}</p></Item>
            <AdminLink />
            <Item><p className="text-xs mb-2"><Link href="/legal/privacy" className="underline">{t("Politique de confidentialité", "Privacy Policy")}</Link> · <Link href="/legal/terms" className="underline">{t("Conditions d’utilisation", "Terms of Use")}</Link></p></Item>
            <Item><p className="text-xs text-smoke">{APP_NAME} v0.6 · {t("fonctionne hors ligne", "works offline")} · {stats.xp.toLocaleString(locale())} {t("XP sur cet appareil", "XP on this device")}</p></Item>
          </div>
        </Stagger>
        <Toast text={toast} />
      </Screen>
    </Page>
  );
}

/** When the account last saved, in words. Everything saves on its own; this
 *  is here so nobody has to wonder whether it did. */
function SyncLine() {
  const t = useT();
  const [state, setState] = useState(() => ({ status: typeof window === "undefined" ? null : readSyncStatus(), now: Date.now() }));
  useEffect(() => { const id = setInterval(() => setState({ status: readSyncStatus(), now: Date.now() }), 3000); return () => clearInterval(id); }, []);
  const { status, now } = state;
  if (!status) return <p className="text-xs text-smoke">{t("Sauvegarde automatique.", "Saves automatically.")}</p>;
  const mins = Math.round((now - new Date(status.at).getTime()) / 60000);
  const when = mins < 1 ? t("à l’instant", "just now") : mins < 60 ? t(`il y a ${mins} min`, `${mins} min ago`) : new Date(status.at).toLocaleString(locale(), { weekday: "short", hour: "numeric", minute: "2-digit" });
  return status.ok
    ? <p className="text-xs text-smoke"><span className="inline-block w-1.5 h-1.5 rounded-full bg-volt mr-1.5 align-middle" />{t("Sauvegardé", "Saved")} {when} · {t("automatique", "automatic")}</p>
    : <p className="text-xs text-danger">{t("La dernière sauvegarde a échoué", "Last save failed")} ({when}){t(" : ", ": ")}{status.message}. {t("Elle réessaie toute seule.", "It retries on its own.")}</p>;
}

/** Shown only to admins (the database decides who that is). */
function AdminLink() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    amAdmin().then((v) => { if (alive) setOk(v); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const t = useT();
  if (!ok) return null;
  return <Item><Link href="/admin" className="pill pill--volt pill--block mb-4">{t("Bureau des récompenses (admin)", "Rewards desk (admin)")}</Link></Item>;
}
