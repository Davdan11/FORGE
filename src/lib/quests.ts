import { XP } from "./gamification";
import { locale, tr } from "./i18n";
import type { Activity, NutritionDay, Readiness, Session } from "./types";

/* ─────────────────────────────────────────────────────────────
   Daily quests — the game loop made visible. Four things a day,
   each paid in XP by the same table the engine uses, so the number
   on Today is the number that lands in the profile.
   ───────────────────────────────────────────────────────────── */
export type Quest = { id: string; label: string; detail: string; xp: number; done: boolean; progress?: [number, number]; href?: string; action?: "flow" };

export const flowKey = (date: string) => `forge-flow-${date}`;
export function flowDoneToday(date: string) { try { return localStorage.getItem(flowKey(date)) === "1"; } catch { return false; } }
export function markFlowDone(date: string) { try { localStorage.setItem(flowKey(date), "1"); } catch { /* private mode */ } }

export function dailyQuests(input: { date: string; readiness?: Readiness | null; session?: Session | null; nutrition?: NutritionDay | null; activitiesToday: Activity[] }): Quest[] {
  const { date, readiness, session, nutrition, activitiesToday } = input;
  const q: Quest[] = [];
  q.push({ id: "checkin", label: tr("Check-in du matin", "Morning check-in"), detail: tr("Sommeil, courbatures, stress : ça ajuste la charge du jour.", "Sleep, soreness, stress — it tunes today’s load."), xp: XP.readinessCheckIn, done: !!readiness, href: "#readiness" });
  if (session) {
    q.push({ id: "session", label: session.title, detail: `${session.minutes} min · ${session.exercises.length} ${session.exercises.length === 1 ? tr("mouvement", "movements") : tr("mouvements", "movements")}`, xp: session.status === "adjusted" ? XP.sessionAdjustedDone : XP.sessionDone, done: session.status === "done", href: `/session?id=${session.id}` });
  } else {
    const min = activitiesToday.reduce((a, b) => a + b.durationSec / 60, 0);
    q.push({ id: "move", label: tr("Bouge 20 minutes", "Move 20 minutes"), detail: tr("N’importe quel sport, GPS activé. Un rythme facile suffit.", "Any sport, GPS on. An easy pace is enough."), xp: XP.activityBase, done: min >= 20, progress: [Math.min(20, Math.round(min)), 20], href: "/move" });
  }
  if (nutrition && nutrition.meals.length) {
    const done = nutrition.meals.filter((m) => m.done).length;
    q.push({ id: "meals", label: tr("Enregistre chaque repas", "Log every meal"), detail: `${nutrition.targets.kcal.toLocaleString(locale())} ${tr("kcal prévues", "kcal planned")} · ${nutrition.targets.protein} ${tr("g de protéines", "g protein")}`, xp: XP.mealLogged * nutrition.meals.length + XP.fullNutritionDay, done: done === nutrition.meals.length, progress: [done, nutrition.meals.length], href: "/food" });
  }
  q.push({ id: "flow", label: tr("Routine de mobilité de 12 minutes", "12-minute mobility flow"), detail: tr("Six mouvements, deux minutes chacun. Hanches, haut du dos, chevilles.", "Six moves, two minutes each. Hips, upper back, ankles."), xp: Math.round(12 * XP.mobilityMinute) + 30, done: flowDoneToday(date), action: "flow" });
  return q;
}
