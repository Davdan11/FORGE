import type { NutritionDay, Profile, Readiness, Session } from "./types";
import { nudgesFor, SLOT_LABEL } from "./nutrition/engine";
import { getMeal } from "./nutrition/recipes";
import { mealTitle } from "./nutrition/cookbook";
import { sessionTitle } from "./engine/plan";
import { getLang, loc, tr } from "./i18n";

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

/** Extras beyond the plan: indoor events the rider asked to be reminded of, and the week streak. */
export interface ReminderExtras {
  events?: { id: string; title: string; route: string; start: Date }[];
  /** Weeks in a row with training, and whether this week already counts. */
  streak?: { weeks: number; thisWeekDone: boolean };
}

export function remindersFor(profile: Profile, days: Day[], now: Date, extras: ReminderExtras = {}): Reminder[] {
  if (!profile.notifications) return [];
  const out: Reminder[] = [];
  // Indoor events the rider tapped "remind me" on: ten minutes before the start.
  for (const e of extras.events ?? []) {
    out.push({ key: `event:${e.id}`, at: new Date(e.start.getTime() - 10 * 60000), title: tr(`${e.title} dans 10 min`, `${e.title} in 10 min`), body: tr(`${e.route} · réchauffe-toi et monte sur le vélo.`, `${e.route} · warm up and get on the bike.`), url: "/indoor" });
  }
  // Sunday, late afternoon: a streak about to break if nothing happens this week.
  const st = extras.streak;
  if (st && st.weeks > 0 && !st.thisWeekDone) {
    const sunday = new Date(now); sunday.setDate(now.getDate() + ((7 - now.getDay()) % 7)); sunday.setHours(17, 0, 0, 0);
    out.push({ key: `streak:${sunday.toDateString()}`, at: sunday, title: tr(`Ta série de ${st.weeks} semaine${st.weeks > 1 ? "s" : ""} est en jeu`, `Your ${st.weeks}-week streak is on the line`), body: tr("Une séance, une sortie ou 20 minutes sur le vélo d’ici ce soir, et elle continue.", "One session, one outing or 20 minutes on the bike tonight keeps it going."), url: "/today" });
  }
  for (const d of days) {
    // Morning check-in, half an hour after waking, unless it is already done.
    if (!d.readiness) {
      out.push({
        key: `checkin:${d.date}`, at: at(d.date, profile.wakeTime || "07:00", 30),
        title: tr("Bilan du matin", "Morning check-in"), body: d.session ? tr(`20 secondes, et ta séance ${sessionTitle(d.session.kind).toLowerCase()} d’aujourd’hui s’ajuste à ton sommeil.`, `20 seconds, and today's ${loc(d.session.title, "en").toLowerCase()} is tuned to how you slept.`) : tr("20 secondes : sommeil, courbatures, stress. +20 XP.", "20 seconds: sleep, soreness, stress. +20 XP."), url: "/today",
      });
    }
    // An hour before a session that is still to do.
    const s = d.session;
    if (s && (s.status === "planned" || s.status === "adjusted")) {
      const start = at(d.date, profile.trainTime || "18:00");
      out.push({
        key: `session:${s.id}`, at: new Date(start.getTime() - 60 * 60000),
        title: tr(`${sessionTitle(s.kind)} à ${hhmm(start)}`, `${loc(s.title, "en")} at ${hhmm(start)}`),
        // The pre-workout meal nudge already says what to eat; don't say it twice.
        body: tr(`${s.minutes} min · ${s.exercises.length} mouvement${s.exercises.length > 1 ? "s" : ""}.${d.nutrition?.meals.some((m) => m.slot === "pre") ? "" : " Mange quelque chose maintenant si ce n’est pas fait."}`, `${s.minutes} min · ${s.exercises.length} movements.${d.nutrition?.meals.some((m) => m.slot === "pre") ? "" : " Eat something now if you haven't."}`),
        url: `/session?id=${s.id}`,
      });
    }
    // Every meal still to eat, at its time: the dish, its portion's kcal and
    // protein. Phones mirror these to a paired watch (Garmin, Apple Watch), so
    // the wrist says what to eat; a tap opens the recipe with its photo.
    if (d.nutrition) {
      const nudges = nudgesFor(d.nutrition, s ?? null);
      for (const m of d.nutrition.meals) {
        if (m.done) continue;
        const meal = getMeal(m.mealId); if (!meal) continue;
        const name = mealTitle(meal, getLang())[0];
        const kcal = Math.round(meal.kcal * m.scale), protein = Math.round(meal.protein * m.scale);
        const around = nudges.find((n) => n.time === m.time && (m.slot === "pre" || m.slot === "post"));
        const slot = SLOT_LABEL[m.slot];
        out.push({
          key: `meal:${d.date}:${m.time}:${m.slot}`, at: at(d.date, m.time),
          title: around ? around.title : tr(`${slot.fr} · ${m.time}`, `${slot.en} · ${m.time}`),
          body: tr(`${name} — ${kcal} kcal · ${protein} g de protéines. Touche pour la recette.`, `${name} — ${kcal} kcal · ${protein} g protein. Tap for the recipe.`),
          url: `/food/meal?id=${encodeURIComponent(m.mealId)}&date=${d.date}`,
        });
      }
      // The evening heads-up about tomorrow's calories.
      for (const n of nudges) if (n.time === "20:30") out.push({ key: `meal:${d.date}:${n.time}:${n.title}`, at: at(d.date, n.time), title: n.title, body: n.body, url: "/food" });
    }
  }
  // Only what is still ahead, soonest first.
  return out.filter((r) => r.at.getTime() > now.getTime()).sort((a, b) => a.at.getTime() - b.at.getTime());
}
