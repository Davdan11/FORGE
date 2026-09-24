import { supabase } from "./supabase/client";
import { BADGES, LEVELS_PER_TIER, SUB_RANKS, TIERS, badgeName, levelFromXp, rankFor, subRankFor, tierForLevel, tierName } from "./gamification";
import { getLang, loc, tr } from "./i18n";
import type { Activity, LoggedSet, Profile, Session, Stats, WeighIn } from "./types";

/* ─────────────────────────────────────────────────────────────
   Real gifts, decided by the owner.

   A campaign says what is given (title, photo, description), who
   qualifies (a rank, a level, a badge, a week streak, or sessions
   in the month), when, and how many. Athletes see open campaigns
   on the ranks page with their progress, and claim with a
   shipping address. Every claim carries a report of what the
   athlete actually did, and nothing ships until the owner has
   read it and approved it. The database enforces the rest (see
   supabase/rewards.sql): stock, a daily cap, one claim each.
   ───────────────────────────────────────────────────────────── */

export type RuleType = "rank" | "level" | "badge" | "streak" | "sessions_month";

export interface Campaign {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  rule_type: RuleType;
  rule_value: string;
  starts_at: string;
  ends_at: string | null;
  stock: number;
  daily_cap: number;
  active: boolean;
  created_at?: string;
}

export type ClaimStatus = "requested" | "approved" | "shipped" | "rejected";

export interface Address {
  ship_name: string; ship_line1: string; ship_line2?: string; ship_city: string;
  ship_region?: string; ship_postal: string; ship_country: string; ship_phone?: string;
}

export interface Claim extends Partial<Address> {
  id: string; campaign_id: string; user_id: string; status: ClaimStatus;
  report: ClaimReport; tracking: string | null; admin_note: string | null; created_at: string; decided_at: string | null;
}

/* ── Who qualifies (pure) ──────────────────────────────────── */

const PER_SUB = LEVELS_PER_TIER / SUB_RANKS.length;

/** The first level of a rank rule: "gold" is Gold I, "gold:III" is Gold III. */
export function rankRuleLevel(value: string): number | null {
  const [key, sub] = value.split(":");
  const tier = TIERS.find((t) => t.key === key);
  if (!tier) return null;
  const i = sub ? SUB_RANKS.indexOf(sub as (typeof SUB_RANKS)[number]) : 0;
  return i < 0 ? null : tier.from + i * PER_SUB;
}

export interface Standing { level: number; xp: number; badges: string[]; streakWeeks: number; sessionsThisMonth: number }

/** Whether someone qualifies, and how far along they are: [have, need]. */
export function qualifies(rule_type: RuleType, rule_value: string, s: Standing): { ok: boolean; have: number; need: number; label: string } {
  switch (rule_type) {
    case "rank": {
      const need = rankRuleLevel(rule_value) ?? 999;
      const t = tierForLevel(need);
      return { ok: s.level >= need, have: Math.min(s.level, need), need, label: tr(`Atteins ${tierName(t, "fr")} ${subRankFor(need)}`, `Reach ${t.name} ${subRankFor(need)}`) };
    }
    case "level": { const need = Number(rule_value) || 999; return { ok: s.level >= need, have: Math.min(s.level, need), need, label: tr(`Atteins le niveau ${need}`, `Reach level ${need}`) }; }
    case "badge": { const ok = s.badges.includes(rule_value); return { ok, have: ok ? 1 : 0, need: 1, label: tr(`Obtiens le badge « ${frBadge(rule_value)} »`, `Earn the "${rule_value.replace(/_/g, " ")}" badge`) }; }
    case "streak": { const need = Number(rule_value) || 999; return { ok: s.streakWeeks >= need, have: Math.min(s.streakWeeks, need), need, label: tr(`Série de ${need} semaine${need > 1 ? "s" : ""}`, `${need}-week streak`) }; }
    case "sessions_month": { const need = Number(rule_value) || 999; return { ok: s.sessionsThisMonth >= need, have: Math.min(s.sessionsThisMonth, need), need, label: tr(`${need} séance${need > 1 ? "s" : ""} ce mois-ci`, `${need} sessions this month`) }; }
  }
}

function frBadge(id: string) {
  const b = BADGES.find((x) => x.id === id);
  return b ? badgeName(b, "fr") : id.replace(/_/g, " ");
}

/** A campaign is open now when it is active, started, not ended. */
export const isOpen = (c: Campaign, now = new Date()) =>
  c.active && new Date(c.starts_at) <= now && (!c.ends_at || new Date(c.ends_at) >= now);

/* ── The report attached to every claim (pure) ─────────────── */

export interface ClaimReport {
  at: string;
  name: string;
  accountAgeDays: number;
  level: number; xp: number; rank: string;
  xpPerDay: number;
  sessionsDone: number; setsLogged: number;
  activities: number; gpsActivities: number; distanceKm: number;
  indoorMinutes: { measured: number; estimated: number; declared: number };
  streakWeeks: number; badges: number;
  weightChangeKg?: number;
  recent: string[];
  /** Plain-language warnings for the owner. None is not proof of honesty. */
  flags: string[];
}

export function buildReport(input: { profile: Profile; stats: Stats; sessions: Session[]; sets: LoggedSet[]; activities: Activity[]; weights: WeighIn[]; now?: Date }): ClaimReport {
  const now = input.now ?? new Date();
  const ageDays = Math.max(1, Math.round((now.getTime() - new Date(input.profile.createdAt).getTime()) / 86_400_000));
  const lvl = levelFromXp(input.stats.xp);
  const done = input.sessions.filter((s) => s.status === "done");
  const indoor = { measured: 0, estimated: 0, declared: 0 };
  for (const a of input.activities) {
    const q = a.meta?.indoor?.quality;
    if (q) indoor[q] += Math.round((a.movingSec ?? a.durationSec) / 60);
  }
  const gps = input.activities.filter((a) => (a.points?.length ?? 0) > 20).length;
  const weights = [...input.weights].sort((a, b) => a.date.localeCompare(b.date));
  const start = input.profile.startWeightKg ?? weights[0]?.kg;
  const latest = weights.at(-1)?.kg;
  const xpPerDay = Math.round(input.stats.xp / ageDays);

  const flags: string[] = [];
  // The ladder is calibrated on ~360 XP for a full, real day (lib/gamification.ts).
  if (xpPerDay > 450) flags.push(`Climbed fast: ${xpPerDay} XP a day on average; a full, real training day earns about 360.`);
  if (ageDays < 21) flags.push(`New account: ${ageDays} days old.`);
  const indoorTotal = indoor.measured + indoor.estimated + indoor.declared;
  if (indoorTotal > 60 && indoor.declared / indoorTotal > 0.5) flags.push(`Most indoor time was set by hand (${indoor.declared} of ${indoorTotal} min), not measured.`);
  if (done.length >= 5 && input.sets.length < done.length * 4) flags.push(`${done.length} sessions marked done with only ${input.sets.length} sets logged.`);
  if (input.activities.length >= 5 && gps === 0 && indoorTotal === 0) flags.push("Activities without GPS tracks.");

  const recent = [
    ...done.map((s) => ({ d: s.date, t: `Session · ${loc(s.title, "en")}` })),
    ...input.activities.map((a) => ({ d: a.startedAt.slice(0, 10), t: `${a.meta?.indoor ? "Indoor" : "Activity"} · ${a.title} · ${(a.distanceM / 1000).toFixed(1)} km` })),
  ].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 12).map((x) => `${x.d} — ${x.t}`);

  return {
    at: now.toISOString(), name: input.profile.name, accountAgeDays: ageDays,
    level: lvl.level, xp: input.stats.xp, rank: `${rankFor(lvl.level, "en")}`, xpPerDay,
    sessionsDone: done.length, setsLogged: input.sets.length,
    activities: input.activities.length, gpsActivities: gps,
    distanceKm: Math.round(input.activities.reduce((a, x) => a + x.distanceM, 0) / 100) / 10,
    indoorMinutes: indoor, streakWeeks: input.stats.streakWeeks, badges: input.stats.badges.length,
    weightChangeKg: start != null && latest != null ? Math.round((latest - start) * 10) / 10 : undefined,
    recent, flags,
  };
}

/* ── Talking to the server ─────────────────────────────────── */

const need = () => { if (!supabase) throw new Error(tr("Les comptes sont pas configurés dans cette version.", "Accounts aren't set up in this build.")); return supabase; };
const clean = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export async function openCampaigns(): Promise<Campaign[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("reward_campaigns").select("*").eq("active", true).order("starts_at", { ascending: false });
  if (error) return [];
  return (data as Campaign[]).filter((c) => isOpen(c));
}

export async function myClaims(): Promise<Claim[]> {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("reward_claims").select("*").eq("user_id", user.id);
  return (data as Claim[]) ?? [];
}

export async function claimReward(campaignId: string, address: Address, report: ClaimReport) {
  const sb = need();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error(tr("Connecte-toi pour réclamer une récompense : il faut un compte pour l’expédier.", "Sign in to claim a reward: it needs an account to ship to."));
  const { error } = await sb.from("reward_claims").insert({ campaign_id: campaignId, user_id: user.id, ...address, report });
  if (error) throw new Error(error.message.includes("duplicate") ? tr("Tu as déjà réclamé celle-ci.", "You have already claimed this one.") : error.message);
}

export async function amAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

/* Admin only: the database refuses these for anyone else. */
export async function allCampaigns(): Promise<Campaign[]> {
  const { data, error } = await need().from("reward_campaigns").select("*").order("created_at", { ascending: false });
  clean(error);
  return data as Campaign[];
}
export async function saveCampaign(c: Partial<Campaign> & Pick<Campaign, "title" | "rule_type" | "rule_value" | "stock">) {
  const { error } = await need().from("reward_campaigns").upsert(c);
  clean(error);
}
export async function deleteCampaign(id: string) { clean((await need().from("reward_campaigns").delete().eq("id", id)).error); }
export async function uploadRewardImage(file: File): Promise<string> {
  const sb = need();
  const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").toLowerCase()}`;
  clean((await sb.storage.from("rewards").upload(path, file, { contentType: file.type, upsert: false })).error);
  return sb.storage.from("rewards").getPublicUrl(path).data.publicUrl;
}
export async function allClaims(): Promise<Claim[]> {
  const { data, error } = await need().from("reward_claims").select("*").order("created_at", { ascending: false }).limit(1000);
  clean(error);
  return data as Claim[];
}
export async function decideClaim(id: string, status: ClaimStatus, extra: { tracking?: string; admin_note?: string } = {}) {
  clean((await need().from("reward_claims").update({ status, decided_at: new Date().toISOString(), ...extra }).eq("id", id)).error);
}
export async function purgeOldAddresses(): Promise<number> {
  const { data, error } = await need().rpc("purge_reward_addresses");
  return error ? 0 : (data as number);
}

/** Shipping list for approved claims, as CSV (opens in any spreadsheet). */
export function claimsCsv(claims: Claim[], campaigns: Campaign[]) {
  const title = (id: string) => campaigns.find((c) => c.id === id)?.title ?? id;
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = getLang() === "fr"
    ? ["Récompense", "Statut", "Nom", "Adresse ligne 1", "Adresse ligne 2", "Ville", "Région", "Code postal", "Pays", "Téléphone", "Réclamée", "Suivi"]
    : ["Reward", "Status", "Name", "Address line 1", "Address line 2", "City", "Region", "Postal code", "Country", "Phone", "Claimed", "Tracking"];
  const rows = claims.map((c) => [title(c.campaign_id), c.status, c.ship_name, c.ship_line1, c.ship_line2, c.ship_city, c.ship_region, c.ship_postal, c.ship_country, c.ship_phone, c.created_at.slice(0, 10), c.tracking]);
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export const RULE_LABEL: Record<RuleType, string> = {
  rank: "Reach a rank", level: "Reach a level", badge: "Earn a badge", streak: "Hold a week streak", sessions_month: "Sessions this month",
};
const RULE_LABEL_FR: Record<RuleType, string> = {
  rank: "Atteindre un rang", level: "Atteindre un niveau", badge: "Obtenir un badge", streak: "Garder une série de semaines", sessions_month: "Séances ce mois-ci",
};
/** A rule's label in the current language. */
export const ruleLabel = (r: RuleType) => tr(RULE_LABEL_FR[r], RULE_LABEL[r]);
