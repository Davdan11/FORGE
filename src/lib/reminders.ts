import type { NutritionDay, Profile, Readiness, Session } from "./types";
import { nudgesFor } from "./nutrition/engine";
import { sessionTitle } from "./engine/plan";
import { tr } from "./i18n";

/* ─────────────────────────────────────────────────────────────
   Which reminders the athlete gets, and when.

   Pure: it looks at the next two days and returns the list. The
   phone schedules them (lib/notify.ts), so they arrive with the
   app closed. The list is rebuilt every time the app opens and
   whenever something changes (a check-in, a finished session), so
   a reminder for something already done is taken back.

   Few and useful beats many: a check-in each morning, one heads-up
   an hour before a planned session, and meal nudges for someone
   who asked for them.
   ───────────────────────────────────────────────────────────── */

export interface Reminder {
  /** Stable, so rescheduling replaces rather than duplicates. */
  key: string;
  at: Date;
  title: string;
  body: string;
  /** Where a tap opens the app. */
  url: string;
}

export interface Day { date: string; session: Session | null; nutrition: NutritionDay | null; readiness: Readiness | null }

const at = (date: string, hhmm: string, plusMin = 0) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m + plusMin, 0, 0);
  return d;
};
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function remindersFor(profile: Profile, days: Day[], now: Date): Reminder[] {
  if (!profile.notifications) return [];
  const out: Reminder[] = [];
  for (const d of days) {
    // Morning check-in, half an hour after waking, unless it is already done.
    if (!d.readiness) {
      out.push({
        key: `checkin:${d.date}`, at: at(d.date, profile.wakeTime || "07:00", 30),
        title: tr("Bilan du matin", "Morning check-in"), body: d.session ? tr(`20 secondes, et ta séance ${sessionTitle(d.session.kind).toLowerCase()} d’aujourd’hui s’ajuste à ton sommeil.`, `20 seconds, and today's ${d.session.title.toLowerCase()} is tuned to how you slept.`) : tr("20 secondes : sommeil, courbatures, stress. +20 XP.", "20 seconds: sleep, soreness, stress. +20 XP."), url: "/today",
      });
    }
    // An hour before a session that is still to do.
    const s = d.session;
    if (s && (s.status === "planned" || s.status === "adjusted")) {
      const start = at(d.date, profile.trainTime || "18:00");
      out.push({
        key: `session:${s.id}`, at: new Date(start.getTime() - 60 * 60000),
        title: tr(`${sessionTitle(s.kind)} à ${hhmm(start)}`, `${s.title} at ${hhmm(start)}`),
        // The pre-workout meal nudge already says what to eat; don't say it twice.
        body: tr(`${s.minutes} min · ${s.exercises.length} mouvement${s.exercises.length > 1 ? "s" : ""}.${d.nutrition?.meals.some((m) => m.slot === "pre") ? "" : " Mange quelque chose maintenant si ce n’est pas fait."}`, `${s.minutes} min · ${s.exercises.length} movements.${d.nutrition?.meals.some((m) => m.slot === "pre") ? "" : " Eat something now if you haven't."}`),
        url: `/session?id=${s.id}`,
      });
    }
    // Meal nudges, from the day's own menu.
    if (d.nutrition) {
      for (const n of nudgesFor(d.nutrition, s ?? null)) {
        out.push({ key: `meal:${d.date}:${n.time}:${n.title}`, at: at(d.date, n.time), title: n.title, body: n.body, url: "/food" });
      }
    }
  }
  // Only what is still ahead, soonest first.
  return out.filter((r) => r.at.getTime() > now.getTime()).sort((a, b) => a.at.getTime() - b.at.getTime());
}
