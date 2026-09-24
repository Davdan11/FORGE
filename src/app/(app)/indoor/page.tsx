"use client";

import { sparks, TEST_BONUS } from "@/lib/shop";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bluetooth, ChevronRight, Flag, Medal, Mountain, Play, Shirt, Timer, Users, Wind, Zap } from "lucide-react";
import { db, getProfile, getStats } from "@/lib/db";
import { guessFtp } from "@/lib/indoor/physics";
import { peekRoom } from "@/lib/indoor/live";
import { GAME_ROUTES, categoryFor, upcomingEvents } from "@/lib/indoor/forgeRide";
import { useLang, useT } from "@/lib/i18n";
import { levelFromXp, rankFor } from "@/lib/gamification";
import { isConfigured } from "@/lib/supabase/client";
import { ScreenSkeleton, Toast } from "@/components/ui";
import { Page, Press } from "@/components/motion";
import { UnityRide } from "@/components/indoor/UnityRide";
import { Platforms } from "@/components/indoor/Platforms";
import type { Profile as AthleteProfile } from "@/lib/types";

/* Indoor is FORGE Ride, the Unity game, presented like a game launch: a
   cinematic hero made of real in-game shots, what is live right now (people
   online, the next group ride, your level and race category), the nine
   worlds, what the game does, and one big button to ride. The game itself
   runs in UnityRide, which keeps sensors, XP and saving in the app. The
   page follows the app language (French or English). */

const HERO = ["hero", "alpine", "provence", "sakura", "giant"].map((n) => `/indoor/${n}.jpg`);
const PINK = "#FF2E78", ORANGE = "#FF5A3D";

export default function IndoorPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const stats = useLiveQuery(() => getStats(), []);
  const indoor = useLiveQuery(() => db.activities.filter((a) => !!a.meta?.indoor).toArray(), []);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3400); };
  const lang = useLang();
  const t = useT();

  // TEMPORARY, remove before launch: the owner's garage test bonus, from the link /indoor?bonus=<code> (once per device).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("bonus") !== TEST_BONUS.code) return;
    url.searchParams.delete("bonus");
    window.history.replaceState(null, "", url.pathname + url.search);
    getStats().then(async (s) => {
      if ((s.testSparks ?? 0) >= TEST_BONUS.sparks) { say(t("Bonus de test déjà ajouté.", "Test bonus already added.")); return; }
      await db.stats.put({ ...s, testSparks: TEST_BONUS.sparks, dirty: 1, updatedAt: new Date().toISOString() });
      say(t(`+${TEST_BONUS.sparks.toLocaleString("fr-CA")} étincelles de test ajoutées`, `+${TEST_BONUS.sparks.toLocaleString("en-US")} test sparks added`));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // /indoor?ride=<route key>: straight into the game on that road (a friend's "Join" on the Social page).
  const [startRoute, setStartRoute] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href), key = url.searchParams.get("ride");
    if (!key || !/^[cg][\w-]{0,40}$/.test(key)) return;
    url.searchParams.delete("ride");
    window.history.replaceState(null, "", url.pathname + url.search);
    setStartRoute(key); setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live: the next events (from the game's own schedule) and the people riding now.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 20_000); return () => clearInterval(id); }, []);
  const events = useMemo(() => upcomingEvents(4, now), [now]);
  const [online, setOnline] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!isConfigured || playing) return;
    const stops = GAME_ROUTES.map((r) => peekRoom(`unity:${r.key}`, "ride", (n) => setOnline((o) => ({ ...o, [r.key]: n }))));
    return () => stops.forEach((s) => s());
  }, [playing]);
  const onlineTotal = Object.values(online).reduce((a, b) => a + b, 0);

  // The hero slideshow.
  const [slide, setSlide] = useState(0);
  useEffect(() => { const id = setInterval(() => setSlide((s) => (s + 1) % HERO.length), 6500); return () => clearInterval(id); }, []);

  // A sticky "ride" button once the hero's button has scrolled away.
  // Hidden while either big button (the hero's, the final call's) is on screen.
  const heroCta = useRef<HTMLDivElement>(null);
  const finalCta = useRef<HTMLElement>(null);
  const [inView, setInView] = useState({ hero: true, final: false });
  useEffect(() => {
    const els = [heroCta.current, finalCta.current];
    if (!els[0] || !els[1]) return;
    const io = new IntersectionObserver((entries) => setInView((v) => {
      const next = { ...v };
      for (const e of entries) next[e.target === els[0] ? "hero" : "final"] = e.isIntersecting;
      return next;
    }), { threshold: 0 });
    els.forEach((el) => io.observe(el!));
    return () => io.disconnect();
  }, [profile, playing]);
  const sticky = !inView.hero && !inView.final;

  if (!profile) return <ScreenSkeleton />;
  const ftpW = profile.ftpW ?? guessFtp(profile.weightKg, profile.level);

  if (playing) {
    return (
      <Page>
        <UnityRide profile={profile} ftpW={ftpW} startRoute={startRoute} say={say} onExit={(msg) => { setPlaying(false); if (msg) say(msg); }} />
        <Toast text={toast} />
      </Page>
    );
  }

  const lvl = levelFromXp(stats?.xp ?? 0);
  const cat = categoryFor(ftpW, profile.weightKg);
  const rides = indoor ?? [];
  const locale = lang === "fr" ? "fr-CA" : "en-US";
  const km = rides.reduce((s, a) => s + a.distanceM, 0) / 1000;
  const hours = rides.reduce((s, a) => s + (a.movingSec ?? a.durationSec), 0) / 3600;
  const xp = rides.reduce((s, a) => s + (a.xp ?? 0), 0);
  const next = events[0];
  const minutesTo = (d: Date) => Math.max(0, Math.round((d.getTime() - now) / 60_000));
  const clock = (d: Date) => d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const ride = () => setPlaying(true);

  return (
    <Page>
      <style>{`
        @keyframes fr-kb { from { transform: scale(1.04) translate3d(0,0,0) } to { transform: scale(1.16) translate3d(-2%, -1%, 0) } }
        @keyframes fr-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        @keyframes fr-rise { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: none } }
        .fr-kb { animation: fr-kb 9s ease-out both }
        .fr-rise { animation: fr-rise .9s cubic-bezier(.2,.8,.2,1) both }
        @media (prefers-reduced-motion: reduce) { .fr-kb, .fr-rise { animation: none } }
        .fr-skew { transform: skewX(-12deg) }
        .fr-skew > * { transform: skewX(12deg) }
        .fr-skew > :not(.inline-flex) { display: inline-block }
        .fr-scroll { scrollbar-width: none } .fr-scroll::-webkit-scrollbar { display: none }
      `}</style>

      <div className="bleed -mt-[calc(var(--safe-top)+16px)] lg:-mt-10 bg-[#07090d] text-bone min-h-screen pb-nav">
        {/* ── HERO ─────────────────────────────────────────────── */}
        <header className="relative h-[92svh] min-h-[600px] max-h-[980px] overflow-hidden">
          {HERO.map((src, i) => (
            <img key={src} src={src} alt="" aria-hidden decoding="async" loading={i === 0 ? "eager" : "lazy"}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1600ms] ${i === slide ? "opacity-100 fr-kb" : "opacity-0"}`} />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090d] via-[#07090d]/35 to-[#07090d]/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07090d]/85 via-[#07090d]/25 to-transparent" />

          <div className="relative h-full flex flex-col justify-end px-5 md:px-12 pb-10 md:pb-16 pt-[calc(var(--safe-top)+20px)] max-w-[1400px] mx-auto">
            <div className="fr-rise flex flex-wrap items-center gap-2 mb-5">
              <span className="text-[11px] tracking-[.28em] uppercase text-bone/70 font-semibold">Indoor · FORGE</span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-xs font-semibold bg-white/10 backdrop-blur">
                <span className="w-2 h-2 rounded-full bg-[#74EB8A]" style={onlineTotal > 0 ? { animation: "fr-pulse 1.6s infinite" } : undefined} />
                {onlineTotal > 0 ? `${onlineTotal} ${t("en ligne", "online now")}` : t("Monde ouvert 24 h sur 24", "World open 24/7")}
              </span>
            </div>

            <h1 className="fr-rise font-black italic uppercase leading-[.82] tracking-[-.04em] text-[clamp(64px,13vw,190px)]" style={{ animationDelay: ".08s" }}>
              <span className="block drop-shadow-[0_8px_30px_rgba(0,0,0,.45)]">FORGE</span>
              <span className="relative inline-block mt-2">
                <span className="absolute -inset-x-4 inset-y-1 fr-skew" style={{ background: `linear-gradient(90deg, ${PINK}, ${ORANGE})`, boxShadow: `0 18px 60px ${PINK}55` }} aria-hidden />
                <span className="relative px-1">RIDE</span>
              </span>
            </h1>

            <p className="fr-rise mt-6 max-w-[620px] text-lg md:text-2xl font-semibold text-bone/90 leading-snug" style={{ animationDelay: ".16s" }}>
              {t("Le monde entier sur ton trainer. Roule en groupe, attaque les cols, bats tes amis.", "The whole world on your trainer. Ride in groups, attack the climbs, beat your friends.")}
            </p>

            <div className="fr-rise mt-6 flex flex-wrap gap-2" style={{ animationDelay: ".22s" }}>
              <Chip><Zap className="w-3.5 h-3.5" /> {t("NIV.", "LVL")} {lvl.level} · {rankFor(lvl.level)}</Chip>
              <Chip><Flag className="w-3.5 h-3.5" /> {t("Catégorie", "Category")} {cat}</Chip>
              <Chip><Timer className="w-3.5 h-3.5" /> FTP {ftpW} W</Chip>
              {next && (
                <Chip accent>
                  <Users className="w-3.5 h-3.5" /> {next.title[lang]} · {next.route.name[lang]} · {minutesTo(next.start) === 0 ? t("maintenant", "now") : t(`dans ${minutesTo(next.start)} min`, `in ${minutesTo(next.start)} min`)}
                </Chip>
              )}
            </div>

            <div ref={heroCta} className="fr-rise mt-8 flex flex-wrap items-center gap-5" style={{ animationDelay: ".3s" }}>
              <Press>
                <button type="button" onClick={ride} className="fr-skew h-[72px] md:h-[84px] px-10 md:px-14 text-white font-black italic uppercase text-2xl md:text-3xl tracking-tight shadow-[0_20px_60px_rgba(255,46,120,.45)] hover:brightness-110 transition"
                  style={{ background: `linear-gradient(90deg, ${PINK}, ${ORANGE})` }}>
                  <span className="inline-flex items-center gap-3"><Play className="w-7 h-7 fill-white" strokeWidth={0} />{t("Jouer", "Ride now")}</span>
                </button>
              </Press>
              <a href="#worlds" className="inline-flex items-center gap-1 text-sm font-semibold text-bone/80 hover:text-bone">{t(`Voir les ${GAME_ROUTES.length} parcours`, `See the ${GAME_ROUTES.length} routes`)}<ChevronRight className="w-4 h-4" /></a>
            </div>
          </div>

          <div className="absolute bottom-5 right-5 md:right-12 flex gap-1.5">
            {HERO.map((_, i) => <button key={i} type="button" aria-label={t(`Image ${i + 1}`, `Slide ${i + 1}`)} onClick={() => setSlide(i)} className={`h-1.5 rounded-full transition-all ${i === slide ? "w-8 bg-white" : "w-3 bg-white/35"}`} />)}
          </div>
        </header>

        <div className="max-w-[1400px] mx-auto px-5 md:px-12">
          {/* ── YOUR NUMBERS ─────────────────────────────────────── */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3 -mt-2 mb-16">
            <Stat label={t("Sorties", "Rides")} value={String(rides.length)} />
            <Stat label={t("Kilomètres", "Kilometres")} value={km.toLocaleString(locale, { maximumFractionDigits: 0 })} />
            <Stat label={t("Heures en selle", "Hours in the saddle")} value={hours.toLocaleString(locale, { maximumFractionDigits: 1 })} />
            <Stat label={t("XP gagnée", "XP earned")} value={xp.toLocaleString(locale)} accent
              note={rides.length > 0 && xp === 0 ? t("Sans capteur, une sortie ne donne pas d'XP : branche un trainer, un capteur de puissance ou un cardio.", "Without a sensor a ride earns no XP: connect a trainer, a power meter or a heart-rate strap.") : undefined} />
            <div className="col-span-2 md:col-span-1"><Stat label={t("Étincelles", "Sparks")} value={(stats ? sparks(stats) : 0).toLocaleString(locale)} accent
              note={t("1 par XP gagnée dans l'app, +100 par badge. Dépense-les au garage du jeu.", "1 per XP earned in the app, +100 per badge. Spend them in the game's garage.")} /></div>
          </section>

          {/* ── YOUR OTHER PLATFORMS (imported .fit rides, one card each) ── */}
          <Platforms forge={{ rides: rides.length, km, hours, climbM: rides.reduce((s, a) => s + a.elevGainM, 0) }} say={say} />

          {/* ── WORLDS ───────────────────────────────────────────── */}
          <SectionHead id="worlds" kicker={t(`${GAME_ROUTES.filter((r) => r.real).length} routes réelles · ${GAME_ROUTES.filter((r) => r.loop).length} circuits · ${GAME_ROUTES.filter((r) => r.challenge).length} défis`, `${GAME_ROUTES.filter((r) => r.real).length} real roads · ${GAME_ROUTES.filter((r) => r.loop).length} circuits · ${GAME_ROUTES.filter((r) => r.challenge).length} challenges`)}
            title={t(`${GAME_ROUTES.length} parcours à rouler`, `${GAME_ROUTES.length} routes to ride`)} />
          <div className="fr-scroll -mx-5 md:-mx-12 px-5 md:px-12 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 mb-16">
            {GAME_ROUTES.map((r) => (
              <button key={r.key} type="button" onClick={ride} className="snap-start shrink-0 w-[270px] md:w-[320px] text-left rounded-2xl overflow-hidden bg-white/[.04] border border-white/10 hover:border-white/30 transition group">
                <div className="relative h-[190px] md:h-[210px] overflow-hidden">
                  <img src={r.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07090d] via-transparent" />
                  {r.real && <span className="absolute top-3 right-3 fr-skew px-3 py-1 text-[11px] font-black italic uppercase text-ink" style={{ background: "#FFD94D" }}><span>{t("Route réelle", "Real road")}</span></span>}
                  {r.challenge && <span className="absolute top-3 left-3 fr-skew px-3 py-1 text-[11px] font-black italic uppercase text-white" style={{ background: PINK }}><span>{t("Défi", "Challenge")}</span></span>}
                  {(online[r.key] ?? 0) > 0 && <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 h-6 inline-flex items-center gap-1 text-[11px] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-[#74EB8A]" />{online[r.key]}</span>}
                </div>
                <div className="h-[3px]" style={{ background: r.accent }} />
                <div className="p-4">
                  <p className="text-[11px] tracking-[.18em] uppercase font-semibold" style={{ color: r.accent }}>{r.country[lang]}</p>
                  <p className="mt-1 text-2xl font-black italic uppercase tracking-tight leading-none">{r.name[lang]}</p>
                  <p className="mt-2 text-xs text-bone/60 line-clamp-1">{r.about[lang]}</p>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="font-black italic text-3xl tabular-nums leading-none">{r.free ? "∞" : r.km}<span className="text-sm not-italic font-semibold text-bone/60 ml-1">{r.free ? t("sans fin", "endless") : r.loop ? t("km / tour", "km / lap") : "km"}</span></span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums"><Mountain className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{r.gainM.toLocaleString(locale)} m</span>
                      <span className="block text-[11px] text-bone/55">{r.level[lang]}</span>
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* ── WHAT'S INSIDE ────────────────────────────────────── */}
          <SectionHead kicker={t("Dans le jeu", "In the game")} title={t("Tout ce qui rend accro", "Everything that hooks you")} />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            <Feature image="/indoor/criterium.jpg" icon={<Wind className="w-5 h-5" />} title={t("L'aspiration, pour vrai", "Real drafting")}
              text={t("Roule dans la roue d'un autre : jusqu'à 33 % d'effort en moins. Le vent baisse dans tes oreilles, tu le sens.", "Sit on a wheel and save up to 33% of the effort. The wind drops in your ears — you feel it.")} />
            <Feature image="/indoor/polders.jpg" icon={<Users className="w-5 h-5" />} title={t("Un départ toutes les 30 min", "A start every 30 minutes")}
              text={t("Sorties de groupe avec un meneur qui attend tout le monde, et courses par catégorie A, B, C, D.", "Group rides with a leader who waits for everyone, and races by category A, B, C, D.")} />
            <Feature image="/indoor/montalcino.jpg" icon={<Medal className="w-5 h-5" />} title={t("Médailles et classement mondial", "Medals and world boards")}
              text={t("Montées et sprints chronométrés, or, argent, bronze — et ton rang mondial, seulement avec des données mesurées.", "Timed climbs and sprints, gold, silver, bronze — and your world rank, measured data only.")} />
            <Feature image="/indoor/tuscan.jpg" icon={<Flag className="w-5 h-5" />} title={t("Défie tes amis", "Challenge your friends")}
              text={t("Ton temps devient un code. Ton ami roule contre ton fantôme, sur la même route.", "Your time becomes a code. Your friend races your ghost on the same road.")} />
            <Feature image="/indoor/pine.jpg" icon={<Timer className="w-5 h-5" />} title={t("Entraînements et test FTP", "Workouts and FTP test")}
              text={t("Dix séances guidées : le trainer tient les watts pour toi. Test de 20 minutes ou rampe, et ton FTP se met à jour.", "Ten guided sessions: the trainer holds the watts for you. 20-minute or ramp test, and your FTP updates.")} />
            <Feature image="/indoor/garage.jpg" icon={<Shirt className="w-5 h-5" />} title={t("Ton garage", "Your garage")}
              text={t("Tenues, casques, souliers, cadres et roues — du commun au légendaire, à débloquer en roulant.", "Kits, helmets, shoes, frames and wheels — common to legendary, unlocked by riding.")} />
          </div>

          {/* ── NEXT STARTS ──────────────────────────────────────── */}
          <SectionHead kicker={t("Horaire", "Schedule")} title={t("Prochains départs", "Next starts")}
            aside={<span className="text-xs text-bone/55">{t("Rejoins dans le jeu : MENU → ÉVÉNEMENTS", "Join in the game: MENU → EVENTS")}</span>} />
          <div className="grid xl:grid-cols-2 gap-3 mb-16">
            {events.map((e, i) => (
              <button key={e.id} type="button" onClick={ride} className="flex items-stretch gap-4 rounded-2xl overflow-hidden bg-white/[.04] border border-white/10 hover:border-white/30 text-left transition">
                <div className="relative w-[110px] md:w-[150px] shrink-0">
                  <img src={e.route.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#07090d]/70" />
                </div>
                <div className="py-4 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="fr-skew px-2.5 py-0.5 text-[11px] font-black italic uppercase whitespace-nowrap" style={{ background: e.race ? PINK : e.kind === "tt" ? "#A875FF" : "#2EF0DE", color: e.race || e.kind === "tt" ? "#fff" : "#07090d" }}><span>{e.title[lang]}</span></span>
                    {i === 0 && <span className="text-[11px] font-semibold text-[#74EB8A]">{t("prochain", "next up")}</span>}
                  </div>
                  <p className="mt-2 text-xl font-black italic uppercase tracking-tight truncate">{e.route.name[lang]}</p>
                  <p className="text-xs text-bone/60 mt-0.5 truncate">{e.route.km} km · {e.race ? t(`catégorie ${cat} pour toi`, `category ${cat} for you`) : e.kind === "tt" ? t("seul contre le chrono, position aéro", "alone against the clock, aero position") : t(`meneur à ${e.wkg.toFixed(1).replace(".", ",")} W/kg`, `leader at ${e.wkg.toFixed(1)} W/kg`)}</p>
                </div>
                <div className="py-4 pr-5 text-right shrink-0">
                  <p className="text-2xl font-black italic tabular-nums leading-none">{clock(e.start)}</p>
                  <p className="text-[11px] text-bone/55 mt-1">{minutesTo(e.start) === 0 ? t("en cours", "starting") : t(`dans ${minutesTo(e.start)} min`, `in ${minutesTo(e.start)} min`)}</p>
                </div>
              </button>
            ))}
          </div>

          {/* ── HOW TO START ─────────────────────────────────────── */}
          <SectionHead kicker={t("Pour commencer", "Getting started")} title={t("Trois étapes, et tu roules", "Three steps and you ride")} />
          <div className="grid md:grid-cols-3 gap-3 mb-6">
            <Step n="1" icon={<Bluetooth className="w-5 h-5" />} title={t("Connecte ton trainer", "Connect your trainer")}
              text={t("Dans le jeu, touche CAPTEURS. Le trainer est détecté tout seul, quelle que soit la marque.", "In the game, tap SENSORS. Your trainer is detected on its own, whatever the brand.")} />
            <Step n="2" icon={<Mountain className="w-5 h-5" />} title={t("Choisis ton monde", "Pick a world")}
              text={t("Un parcours, un défi, le parcours du jour — ou rejoins un départ de groupe.", "A route, a challenge, the daily route — or join a group start.")} />
            <Step n="3" icon={<Zap className="w-5 h-5" />} title={t("Pédale", "Pedal")}
              text={t("La pente durcit ton trainer, l'aspiration t'aide, et chaque sortie compte pour ton XP FORGE.", "Climbs stiffen your trainer, drafting helps, and every ride counts toward your FORGE XP.")} />
          </div>
          <p className="text-xs text-bone/55 mb-16 max-w-[900px]">
            {t("Compatible : Wahoo, Tacx, Elite, Saris, Zwift Hub, Van Rysel, JetBlack, Magene, Wattbike et tout trainer Bluetooth FTMS — plus les capteurs de puissance, de vitesse et de fréquence cardiaque. ", "Works with Wahoo, Tacx, Elite, Saris, Zwift Hub, Van Rysel, JetBlack, Magene, Wattbike and any Bluetooth FTMS trainer — plus power meters, speed sensors and heart-rate straps. ")}
            {t("XP honnête : puissance mesurée 100 %, estimée par le cœur 60 %, glissière 0 %.", "Honest XP: measured power 100%, heart-rate estimate 60%, slider 0%.")}
          </p>

          {/* ── YOUR POWER ───────────────────────────────────────── */}
          <div className="rounded-2xl bg-white/[.04] border border-white/10 p-5 mb-16 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[.18em] uppercase font-semibold text-bone/55">{t("Ta puissance", "Your power")}</p>
              <Ftp t={t} ftpW={ftpW} tested={profile.ftpW != null} onChange={(ftp) => db.profile.update(profile.id, { ftpW: ftp, dirty: 1, updatedAt: new Date().toISOString() } as Partial<AthleteProfile>)} />
            </div>
            <p className="text-xs text-bone/55 max-w-[420px]">{t("Le jeu règle tes entraînements et ta catégorie de course avec ce chiffre. Le test FTP du jeu peut le mettre à jour.", "The game sets your workouts and race category from this number. The in-game FTP test can update it.")}</p>
          </div>

          {/* ── FINAL CALL ───────────────────────────────────────── */}
          <section ref={finalCta} className="relative overflow-hidden rounded-3xl mb-10">
            <img src="/indoor/giant.jpg" alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07090d] via-[#07090d]/70 to-transparent" />
            <div className="relative p-8 md:p-14">
              <p className="text-4xl md:text-6xl font-black italic uppercase tracking-tight leading-[.9] max-w-[640px]">{t("Le col t'attend.", "The climb is waiting.")}</p>
              <Press className="inline-block mt-8">
                <button type="button" onClick={ride} className="fr-skew h-16 px-10 text-white font-black italic uppercase text-xl" style={{ background: `linear-gradient(90deg, ${PINK}, ${ORANGE})` }}>
                  <span className="inline-flex items-center gap-2"><Play className="w-5 h-5 fill-white" strokeWidth={0} />{t("Jouer maintenant", "Ride now")}</span>
                </button>
              </Press>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky ride button once the hero's has scrolled away. */}
      <div className={`fixed inset-x-0 bottom-[calc(var(--safe-bottom)+84px)] lg:bottom-6 z-40 flex justify-center pointer-events-none transition-all duration-300 ${sticky ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        <button type="button" onClick={ride} tabIndex={sticky ? 0 : -1} className={`${sticky ? "pointer-events-auto" : ""} fr-skew h-14 px-9 text-white font-black italic uppercase text-lg shadow-[0_16px_40px_rgba(255,46,120,.5)]`}
          style={{ background: `linear-gradient(90deg, ${PINK}, ${ORANGE})` }}>
          <span className="inline-flex items-center gap-2"><Play className="w-5 h-5 fill-white" strokeWidth={0} />FORGE Ride</span>
        </button>
      </div>
      <Toast text={toast} />
    </Page>
  );
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 h-9 text-xs font-bold backdrop-blur-md ${accent ? "bg-[#FF2E78]/85 text-white" : "bg-white/10 text-bone border border-white/15"}`}>{children}</span>;
}

function Stat({ label, value, accent, note }: { label: string; value: string; accent?: boolean; note?: string }) {
  return (
    <div className="rounded-2xl bg-white/[.05] border border-white/10 p-4 md:p-5">
      <p className="text-[11px] tracking-[.16em] uppercase font-semibold text-bone/55">{label}</p>
      <p className={`mt-1 text-3xl md:text-4xl font-black italic tabular-nums ${accent ? "text-[#FFD23F]" : ""}`}>{value}</p>
      {note && <p className="mt-2 text-[11px] leading-snug text-bone/60">{note}</p>}
    </div>
  );
}

function SectionHead({ kicker, title, aside, id }: { kicker: string; title: string; aside?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="scroll-mt-6 flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <p className="text-[11px] tracking-[.24em] uppercase font-semibold" style={{ color: PINK }}>{kicker}</p>
        <h2 className="mt-1 text-3xl md:text-5xl font-black italic uppercase tracking-tight leading-none">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function Feature({ image, icon, title, text }: { image: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="relative min-h-[300px] rounded-2xl overflow-hidden border border-white/10 group">
      <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07090d] via-[#07090d]/60 to-[#07090d]/5" />
      <div className="relative h-full min-h-[300px] flex flex-col justify-end p-5">
        <span className="w-10 h-10 rounded-xl grid place-items-center mb-3 text-white" style={{ background: `linear-gradient(135deg, ${PINK}, ${ORANGE})` }}>{icon}</span>
        <p className="text-xl font-black italic uppercase tracking-tight leading-tight">{title}</p>
        <p className="mt-1.5 text-sm text-bone/75 leading-snug">{text}</p>
      </div>
    </div>
  );
}

function Step({ n, icon, title, text }: { n: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/[.04] border border-white/10 p-5">
      <div className="flex items-center gap-3">
        <span className="text-4xl font-black italic leading-none" style={{ color: PINK }}>{n}</span>
        <span className="w-9 h-9 rounded-lg grid place-items-center bg-white/10">{icon}</span>
      </div>
      <p className="mt-3 text-lg font-black italic uppercase tracking-tight">{title}</p>
      <p className="mt-1 text-sm text-bone/70 leading-snug">{text}</p>
    </div>
  );
}

/** FTP: guessed from level until the athlete enters a real one. The game sets its targets from it. */
function Ftp({ ftpW, tested, onChange, t }: { ftpW: number; tested: boolean; onChange: (ftp: number) => void; t: (fr: string, en: string) => string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(ftpW));
  return (
    <div className="mt-1 text-sm">
      {!open ? (
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-3xl font-black italic tabular-nums">{ftpW} W</span>
          <span className="text-bone/55">{tested ? "FTP" : t("FTP estimé selon ton niveau", "FTP guessed from your level")}</span>
          <button type="button" className="underline text-bone/80" onClick={() => { setV(String(ftpW)); setOpen(true); }}>{t("Changer", "Change")}</button>
        </p>
      ) : (
        <form className="flex items-center gap-2 mt-1" onSubmit={(e) => {
          e.preventDefault();
          const n = parseFloat(v);
          if (n >= 50 && n <= 600) onChange(Math.round(n));
          setOpen(false);
        }}>
          <input className="input !h-10 w-28 tnum !bg-white/10 !text-bone !border-white/20" type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
          <span>W</span>
          <button type="submit" className="pill pill--sm pill--volt">{t("Enregistrer", "Save")}</button>
        </form>
      )}
    </div>
  );
}
