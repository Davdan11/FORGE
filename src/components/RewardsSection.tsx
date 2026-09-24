"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Gift, Lock, Package, Truck } from "lucide-react";
import { db, getProfile, getStats } from "@/lib/db";
import { levelFromXp } from "@/lib/gamification";
import { buildReport, claimReward, myClaims, openCampaigns, qualifies, type Address, type Campaign, type Claim, type Standing } from "@/lib/rewards";
import { supabase } from "@/lib/supabase/client";
import { Section } from "@/components/ui";
import { AnimatePresence, motion, Press } from "@/components/motion";
import { locale, useLang, useT } from "@/lib/i18n";

/* Every ISO 3166 country code; names come from the phone's own language. */
const COUNTRIES = "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");

/** Open rewards on the ranks page: photo, what it takes, your progress, and a claim. */
export function RewardsSection({ onCampaigns }: { onCampaigns?: (c: Campaign[]) => void }) {
  const stats = useLiveQuery(() => getStats(), []);
  const profile = useLiveQuery(() => getProfile(), []);
  const monthStart = new Date().toISOString().slice(0, 8) + "01";
  const sessionsThisMonth = useLiveQuery(() => db.sessions.where("date").aboveOrEqual(monthStart).filter((s) => s.status === "done").count(), [monthStart]) ?? 0;
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [claiming, setClaiming] = useState<Campaign | null>(null);
  const t = useT();
  useLang(); // re-render on a language change: the rule labels below are written in it

  const fetchAll = () => Promise.all([openCampaigns(), myClaims(), supabase?.auth.getUser().then((r) => r.data.user) ?? null]);
  const apply = useCallback(([c, mine, user]: Awaited<ReturnType<typeof fetchAll>>) => {
    setCampaigns(c); setClaims(mine); setSignedIn(!!user);
    onCampaigns?.(c);
  }, [onCampaigns]);
  const load = async () => apply(await fetchAll());
  useEffect(() => {
    let alive = true;
    fetchAll().then((r) => { if (alive) apply(r); }).catch(() => { if (alive) setCampaigns([]); });
    return () => { alive = false; };
  }, [apply]);

  const standing: Standing | null = useMemo(() => stats ? { level: levelFromXp(stats.xp).level, xp: stats.xp, badges: stats.badges, streakWeeks: stats.streakWeeks, sessionsThisMonth } : null, [stats, sessionsThisMonth]);
  if (!supabase || !campaigns || !standing || !profile || campaigns.length === 0) return null;

  return (
    <Section title={t("Récompenses", "Rewards")} aside={<span className="text-xs text-smoke">{t("de vrais cadeaux, expédiés partout dans le monde", "real gifts, shipped worldwide")}</span>}>
      <div className="grid gap-3">
        {campaigns.map((c) => {
          const q = qualifies(c.rule_type, c.rule_value, standing);
          const claim = claims.find((x) => x.campaign_id === c.id);
          return (
            <div key={c.id} className="card overflow-hidden grid sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="relative h-44 sm:h-full bg-graphite">
                {c.image_url ? <img src={c.image_url} alt={c.title} className="absolute inset-0 w-full h-full object-cover" /> : <Gift className="absolute inset-0 m-auto w-10 h-10 text-smoke" />}
                {!q.ok && <span className="absolute top-2 left-2 chip chip--live backdrop-blur-md"><Lock className="w-3 h-3" /> {t("Verrouillé", "Locked")}</span>}
              </div>
              <div className="p-4 grid gap-2 content-start">
                <span className="meta">{q.label}</span>
                <strong className="display text-xl leading-tight">{c.title}</strong>
                {c.description && <p className="text-sm text-smoke">{c.description}</p>}
                {!q.ok && (
                  <div className="grid gap-1">
                    <div className="bar"><i style={{ width: `${Math.round((q.have / Math.max(1, q.need)) * 100)}%` }} /></div>
                    <span className="text-xs text-smoke tnum">{q.have} / {q.need}</span>
                  </div>
                )}
                {claim ? <ClaimStatusLine claim={claim} />
                  : q.ok ? (signedIn
                    ? <Press><button type="button" className="pill pill--volt pill--block" onClick={() => setClaiming(c)}>{t("Je le réclame", "Claim it")}</button></Press>
                    : <p className="text-xs text-smoke">{t("Tu es admissible. Connecte-toi (Réglages → Compte) pour réclamer : un cadeau a besoin d’une adresse.", "You qualify. Sign in (Settings → Account) to claim: a gift needs somewhere to go.")}</p>)
                  : null}
                {c.ends_at && <span className="text-[11px] text-smoke">{t("Jusqu’au", "Until")} {new Date(c.ends_at).toLocaleDateString(locale(), { month: "long", day: "numeric" })} · {t("jusqu’à épuisement des stocks", "while stock lasts")}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {claiming && (
          <ClaimSheet campaign={claiming} onClose={() => setClaiming(null)} onDone={async () => { setClaiming(null); await load(); }}
            makeReport={async () => buildReport({
              profile, stats: stats!, sessions: await db.sessions.toArray(), sets: await db.sets.toArray(),
              activities: await db.activities.toArray(), weights: await db.weights.toArray(),
            })} />
        )}
      </AnimatePresence>
    </Section>
  );
}

function ClaimStatusLine({ claim }: { claim: Claim }) {
  const t = useT();
  const map = {
    requested: { icon: <Package className="w-4 h-4" />, text: t("Réclamé : on vérifie. Tu vas le voir ici quand ce sera expédié.", "Claimed — we are checking it. You will see it here when it ships.") },
    approved: { icon: <Package className="w-4 h-4" />, text: t("Approuvé : on prépare ton colis.", "Approved — being packed.") },
    shipped: { icon: <Truck className="w-4 h-4" />, text: t(`Expédié${claim.tracking ? ` · suivi ${claim.tracking}` : ""}.`, `Shipped${claim.tracking ? ` · tracking ${claim.tracking}` : ""}.`) },
    rejected: { icon: <Lock className="w-4 h-4" />, text: claim.admin_note ? t(`Pas approuvé : ${claim.admin_note}`, `Not approved: ${claim.admin_note}`) : t("Pas approuvé.", "Not approved.") },
  }[claim.status];
  return <p className={`text-sm flex items-start gap-2 ${claim.status === "rejected" ? "text-danger" : "text-volt"}`}>{map.icon}<span>{map.text}</span></p>;
}

function ClaimSheet({ campaign, onClose, onDone, makeReport }: { campaign: Campaign; onClose: () => void; onDone: () => void; makeReport: () => Promise<ReturnType<typeof buildReport>> }) {
  const region = typeof navigator !== "undefined" ? (navigator.language.split("-")[1] ?? "").toUpperCase() : "";
  const [a, setA] = useState<Address>({ ship_name: "", ship_line1: "", ship_line2: "", ship_city: "", ship_region: "", ship_postal: "", ship_country: COUNTRIES.includes(region) ? region : "", ship_phone: "" });
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = useT();
  const lang = useLang();
  const names = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try { dn = new Intl.DisplayNames([lang === "fr" ? "fr-CA" : "en-US"], { type: "region" }); } catch { /* old engine: codes only */ }
    return COUNTRIES.map((c) => ({ c, n: dn?.of(c) ?? c })).sort((x, y) => x.n.localeCompare(y.n, lang));
  }, [lang]);
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setA({ ...a, [k]: e.target.value });
  const ready = a.ship_name.trim() && a.ship_line1.trim() && a.ship_city.trim() && a.ship_postal.trim() && a.ship_country && ok;

  async function submit() {
    setBusy(true); setErr(null);
    try { await claimReward(campaign.id, a, await makeReport()); navigator.vibrate?.([20, 40, 80]); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : t("Quelque chose a mal tourné.", "Something went wrong.")); }
    finally { setBusy(false); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-ink/60 backdrop-blur-sm grid items-end sm:place-items-center" onClick={onClose}>
      <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}
        className="bg-paper w-full sm:max-w-[520px] rounded-t-[28px] sm:rounded-[28px] p-5 pb-[calc(var(--safe-bottom)+20px)] grid gap-3 max-h-[92dvh] overflow-y-auto">
        <span className="meta">{t("Réclamer", "Claim")} · {campaign.title}</span>
        <h2 className="display text-2xl leading-tight">{t("On l’envoie", "Where should we")} <em>{t("où?", "send it?")}</em></h2>
        <p className="text-xs text-smoke">{t("On expédie partout dans le monde. Chaque réclamation est vérifiée à la main avant de partir.", "We ship worldwide. Every claim is checked by hand before it goes out.")}</p>
        <input className="input" placeholder={t("Nom complet", "Full name")} autoComplete="name" value={a.ship_name} onChange={set("ship_name")} />
        <input className="input" placeholder={t("Adresse", "Address")} autoComplete="address-line1" value={a.ship_line1} onChange={set("ship_line1")} />
        <input className="input" placeholder={t("Appartement, bureau (optionnel)", "Apartment, suite (optional)")} autoComplete="address-line2" value={a.ship_line2} onChange={set("ship_line2")} />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder={t("Ville", "City")} autoComplete="address-level2" value={a.ship_city} onChange={set("ship_city")} />
          <input className="input" placeholder={t("Province / État", "State / province")} autoComplete="address-level1" value={a.ship_region} onChange={set("ship_region")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder={t("Code postal", "Postal code")} autoComplete="postal-code" value={a.ship_postal} onChange={set("ship_postal")} />
          <select className="input" value={a.ship_country} onChange={set("ship_country")} autoComplete="country">
            <option value="">{t("Pays", "Country")}</option>
            {names.map((x) => <option key={x.c} value={x.c}>{x.n}</option>)}
          </select>
        </div>
        <input className="input" placeholder={t("Téléphone, pour le livreur (optionnel)", "Phone, for the courier (optional)")} autoComplete="tel" value={a.ship_phone} onChange={set("ship_phone")} />
        <label className="flex gap-3 items-start text-xs text-smoke">
          <input type="checkbox" className="tick shrink-0 mt-0.5" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>{t("Utiliser cette adresse pour expédier ma récompense. Seuls moi et l’équipe la voient, et elle est effacée quelques mois après la livraison. Un résumé de mon entraînement est joint pour que la réclamation puisse être vérifiée.", "Use this address to ship my reward. It is seen only by me and the team, and erased a few months after delivery. A summary of my training is attached so the claim can be checked.")}</span>
        </label>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex gap-2">
          <button type="button" className="pill" onClick={onClose}>{t("Annuler", "Cancel")}</button>
          <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" disabled={!ready || busy} onClick={submit}>{busy ? t("Envoi…", "Sending…") : t("Je le réclame", "Claim it")}</button></Press>
        </div>
      </motion.div>
    </motion.div>
  );
}
