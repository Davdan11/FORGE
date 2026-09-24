"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Heart, ShieldCheck, ShieldAlert, MapPinOff, Users } from "lucide-react";
import { getProfile } from "@/lib/db";
import { isConfigured } from "@/lib/supabase/client";
import { lastKnownCell, mine, nearby, toggleLike, getHandle, type FeedPost } from "@/lib/social/feed";
import { fmtDist, fmtDuration, fmtPace } from "@/lib/units";
import { SportGlyph } from "@/components/move-bits";
import { RouteThumb } from "@/components/RouteThumb";
import { Screen, Section, ScreenSkeleton, Seg, Toast } from "@/components/ui";
import { Page, Stagger, Item, Press, motion } from "@/components/motion";
import { HandleSetup } from "@/components/HandleSetup";
import type { UnitPrefs } from "@/lib/types";
import { useT } from "@/lib/i18n";

/* ─────────────────────────────────────────────────────────────
   Two tabs and nothing else: what happened near you, and what
   you put out there.

   There is no "following", no profiles to open, no way to ask
   where anyone is. The feed shows finished work in a
   neighbourhood several kilometers wide, and that is the whole
   surface area.
   ───────────────────────────────────────────────────────────── */

type Tab = "near" | "mine";

export default function FeedPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const [tab, setTabState] = useState<Tab>("near");
  const setTab = (x: Tab) => { setTabState(x); setPending(true); };
  const t = useT();
  const [handle, setHandleState] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // One piece of state carrying the tab it belongs to, so "the tab changed and
  // the new one has not arrived" is something we can read off a render rather
  // than something an effect has to blank out first.
  const [loaded, setLoaded] = useState<{ tab: Tab; posts: FeedPost[]; error: string | null; cell: string | null }>(
    { tab: "near", posts: [], error: null, cell: null },
  );
  const [pending, setPending] = useState(true);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    if (!isConfigured) return;
    // A slow request for the tab you just left must not overwrite the one you
    // are looking at now.
    let alive = true;
    (async () => {
      if (tab === "mine") {
        const r = await mine();
        if (alive) { setLoaded({ tab, posts: r.ok ? r.value : [], error: r.ok ? null : r.reason, cell: null }); setPending(false); }
        return;
      }
      const cell = await lastKnownCell();
      const r = cell ? await nearby(cell) : null;
      if (!alive) return;
      setLoaded({ tab, posts: r?.ok ? r.value : [], error: r && !r.ok ? r.reason : null, cell });
      setPending(false);
    })();
    getHandle().then((h) => { if (alive) setHandleState(h); });
    return () => { alive = false; };
  }, [tab]);

  const fresh = loaded.tab === tab && !pending;
  const posts = fresh ? loaded.posts : null;
  const error = fresh ? loaded.error : null;
  const cell = loaded.cell;

  async function like(p: FeedPost) {
    // Move the heart now; the network catches up. A like that waits 300ms to
    // appear feels like it failed, and people press it again.
    const flip = (on: boolean, count: number) => (cur: typeof loaded) =>
      ({ ...cur, posts: cur.posts.map((x) => x.id === p.id ? { ...x, likedByMe: on, likeCount: count } : x) });
    setLoaded(flip(!p.likedByMe, p.likeCount + (p.likedByMe ? -1 : 1)));
    const r = await toggleLike(p.id, p.likedByMe);
    if (!r.ok) { setLoaded(flip(p.likedByMe, p.likeCount)); say(r.reason); }
  }

  if (!profile) return <ScreenSkeleton />;
  const units = profile.units;

  return (
    <Page>
      <Screen>
        <header className="mb-6">
          <span className="eyebrow">{t("Le fil", "The feed")}</span>
          <h1 className="display text-4xl lg:text-5xl mt-2 leading-none">{t("Qui d’autre", "Who else")}<br /><em>{t("s’est présenté.", "showed up.")}</em></h1>
          <p className="text-sm text-smoke mt-3 max-w-[46ch]">
            {t("Du travail terminé dans ton coin. Les parcours apparaissent une fois l’activité enregistrée, les bouts coupés, jamais pendant que quelqu’un est dehors.", "Finished work from your area. Routes appear once an activity is logged, with the ends cut off — never while anyone is out there.")}
          </p>
        </header>

        {/* Social has no tab of its own on a phone (the bar holds six); this is its door. */}
        <Press className="mb-6">
          <Link href="/social" className="card p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-[rgba(31,199,111,.14)] grid place-items-center shrink-0"><Users className="w-5 h-5" /></span>
            <span className="grid min-w-0 flex-1"><span className="font-medium">{t("Social", "Social")}</span><span className="text-xs text-smoke truncate">{t("Amis en selle, clubs et classement FORGE", "Friends riding, clubs and the FORGE ranking")}</span></span>
            <span aria-hidden className="text-smoke">→</span>
          </Link>
        </Press>

        {!isConfigured ? (
          <Offline />
        ) : (
          <>
            <div className="mb-5"><Seg value={tab} onChange={setTab} options={[{ v: "near" as Tab, label: t("Près de toi", "Near you") }, { v: "mine" as Tab, label: t("Tes publications", "Your posts") }]} /></div>

            {!handle && <div className="mb-5"><HandleSetup onDone={(h) => { setHandleState(h); say(t(`T’es @${h}.`, `You are @${h}.`)); }} /></div>}

            {error && <p className="card p-4 text-sm text-smoke">{error}</p>}

            {!error && posts === null && <div className="grid gap-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>}

            {!error && posts?.length === 0 && (
              tab === "mine"
                ? <Empty title={t("Rien de publié encore", "Nothing posted yet")} body={t("Termine une activité, ouvre-la et appuie sur Publier dans le fil. Tu choisis chacune.", "Finish an activity, open it, and press Post to feed. You choose each one.")} />
                : cell === null
                  ? <Empty title={t("Pas encore de zone", "No area yet")} body={t("Enregistre d’abord une activité dehors. Ta zone vient de là où tu t’entraînes, donc l’app a jamais besoin de demander au navigateur où tu es.", "Record an outdoor activity first. Your area comes from where you train, so the app never has to ask the browser where you are.")} />
                  : <Empty title={t("C’est tranquille par ici", "Quiet around here")} body={t("Personne près de toi a publié encore. Sois le premier : ta publication va apparaître ici.", "Nobody near you has posted yet. Be the first — yours will show up here.")} />
            )}

            {!error && posts && posts.length > 0 && (
              <Section title={tab === "mine" ? t("Tes publications", "Your posts") : t("Autour de toi", "Around you")} aside={<span className="text-xs text-smoke tnum">{posts.length}</span>}>
                <Stagger className="grid gap-3" delay={0.04}>
                  {posts.map((p) => <Item key={p.id}><PostCard post={p} units={units} onLike={() => like(p)} /></Item>)}
                </Stagger>
              </Section>
            )}

            <PrivacyNote />
          </>
        )}
      </Screen>
      <Toast text={toast} />
    </Page>
  );
}

function PostCard({ post, units, onLike }: { post: FeedPost; units: UnitPrefs; onLike: () => void }) {
  const t = useT();
  const pace = post.distanceM > 0 && post.durationSec > 0 ? fmtPace(post.durationSec / (post.distanceM / 1000), units) : null;

  return (
    <article className="card p-4 flex gap-4 items-stretch">
      <div className="w-[84px] shrink-0 text-ink self-center">
        <RouteThumb route={post.route} className="w-full h-[84px]" />
      </div>

      <div className="min-w-0 flex-1 grid content-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <SportGlyph sport={post.sport} className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold truncate">@{post.handle}</span>
            {post.mine && <span className="chip">{t("Toi", "You")}</span>}
            <Verdict v={post.verdict} />
          </div>
          <p className="text-sm text-smoke truncate mt-0.5">{post.title}</p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <dl className="flex gap-4 text-xs tnum min-w-0">
            <div className="grid"><dt className="meta">{t("Distance", "Distance")}</dt><dd className="font-semibold text-sm">{fmtDist(post.distanceM, units)}</dd></div>
            <div className="grid"><dt className="meta">{t("Temps", "Time")}</dt><dd className="font-semibold text-sm">{fmtDuration(post.durationSec)}</dd></div>
            {pace && <div className="grid min-w-0"><dt className="meta">{t("Allure", "Pace")}</dt><dd className="font-semibold text-sm truncate">{pace}</dd></div>}
          </dl>

          <Press>
            <button type="button" onClick={onLike} aria-pressed={post.likedByMe}
              aria-label={post.likedByMe ? t(`Retirer ton j’aime de l’activité de ${post.handle}`, `Unlike ${post.handle}'s activity`) : t(`Aimer l’activité de ${post.handle}`, `Like ${post.handle}'s activity`)}
              className={`flex items-center gap-1.5 h-10 px-3 rounded-full border text-xs tnum transition-colors ${post.likedByMe ? "bg-volt border-volt text-ink font-medium" : "border-line-strong text-smoke hover:border-ink hover:text-ink"}`}>
              <motion.span animate={post.likedByMe ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} className="grid place-items-center">
                <Heart className="w-4 h-4" strokeWidth={2} fill={post.likedByMe ? "currentColor" : "none"} />
              </motion.span>
              {post.likeCount > 0 && post.likeCount}
            </button>
          </Press>
        </div>
      </div>
    </article>
  );
}

/** The verdict from the anti-cheat pass. Shown plainly, never as an accusation:
 *  a partial track is usually a tunnel or a dead battery, not a liar. */
function Verdict({ v }: { v: FeedPost["verdict"] }) {
  const t = useT();
  if (v === "verified") return <span className="chip chip--volt ml-auto shrink-0" title={t("Le tracé appuie tout l’effort", "The track supports the whole effort")}><ShieldCheck className="w-3 h-3" strokeWidth={2.4} />{t("Vérifié", "Verified")}</span>;
  if (v === "partial") return <span className="chip ml-auto shrink-0" title={t("Une partie de ce tracé a pas pu être créditée", "Part of this track could not be credited")}><ShieldAlert className="w-3 h-3" strokeWidth={2.4} />{t("Partiel", "Partial")}</span>;
  return <span className="chip ml-auto shrink-0" title={t("Aucun tracé GPS utilisable", "No usable GPS track")}><MapPinOff className="w-3 h-3" strokeWidth={2.4} />{t("Pas de tracé", "No track")}</span>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-6 grid gap-2 text-center">
      <p className="display text-2xl">{title}</p>
      <p className="text-sm text-smoke max-w-[42ch] mx-auto">{body}</p>
    </div>
  );
}

function Offline() {
  const t = useT();
  return (
    <div className="card p-6 grid gap-2">
      <p className="display text-2xl">{t("Le fil a besoin d’un compte", "The feed needs an account")}</p>
      <p className="text-sm text-smoke max-w-[52ch]">
        {t("Tout le reste de l’app fonctionne hors ligne et va toujours fonctionner. Le partage, non : une publication a besoin d’un endroit où vivre. Ajoute tes clés Supabase et connecte-toi dans les Réglages.", "Everything else in the app works offline and always will. Sharing cannot — it needs somewhere for a post to live. Add your Supabase keys and sign in from Settings.")}
      </p>
    </div>
  );
}

function PrivacyNote() {
  const t = useT();
  return (
    <div className="card p-5 mt-6 grid gap-3">
      <span className="eyebrow">{t("Ce que les autres peuvent voir", "What other people can see")}</span>
      <ul className="grid gap-2 text-sm text-smoke">
        <li><strong className="text-ink">{t("Jamais où tu es.", "Never where you are.")}</strong> {t("Une publication peut seulement venir d’une activité terminée. Il y a aucune position en direct dans cette app : pas cachée derrière un réglage, nulle part.", "A post can only be made from a finished activity. There is no live position in this app — not hidden behind a setting, not anywhere.")}</li>
        <li><strong className="text-ink">{t("Pas où tu pars.", "Not where you start.")}</strong> {t("Les 250 premiers et derniers mètres de chaque parcours publié sont coupés, pour que la carte de ta boucle finisse pas à ta porte.", "The first and last 250 m of every published route are cut off, so a map of your loop does not end at your door.")}</li>
        <li><strong className="text-ink">{t("Ton coin, pas ton adresse.", "Your area, not your address.")}</strong> {t("Les publications sont classées dans un carré de plusieurs kilomètres de large, pris au milieu du parcours.", "Posts are filed under a grid square several kilometres wide, taken from the middle of the route.")}</li>
        <li><strong className="text-ink">{t("Rien d’automatique.", "Nothing is automatic.")}</strong> {t("T’appuies sur Publier pour chaque activité, une à la fois, et Retirer l’enlève pour de bon.", "You press Post on each activity, one at a time, and Remove takes it down for good.")}</li>
      </ul>
    </div>
  );
}
