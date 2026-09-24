"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, Crown, LogOut, Search, Trash2, UserCheck, UserMinus, UserPlus, WifiOff } from "lucide-react";
import { getProfile } from "@/lib/db";
import { isConfigured } from "@/lib/supabase/client";
import { getHandle } from "@/lib/social/feed";
import { byRating, findRiders, follow, followers, following, myId, profilesFor, unfollow, type RiderCard } from "@/lib/social/friends";
import { averageRating, CLUB_COLORS, clubMembers, clubProblem, createClub, deleteClub, inkOn, joinClub, leaveClub, listClubs, myClub, normalTag, type Club } from "@/lib/social/clubs";
import { watchOnline, type OnlineRider } from "@/lib/social/online";
import { ratingBoard, ratingPlace, type RatingRow } from "@/lib/social/ratings";
import { ratingTier, type Rating } from "@/lib/indoor/rating";
import { GAME_ROUTES } from "@/lib/indoor/forgeRide";
import { Hero, Screen, ScreenSkeleton, Section, Seg, Skeleton, StatRow, Toast } from "@/components/ui";
import { AnimatePresence, CountUp, Item, Page, Press, Stagger, motion } from "@/components/motion";
import { HandleSetup } from "@/components/HandleSetup";
import { useLang, useT } from "@/lib/i18n";

/* ─────────────────────────────────────────────────────────────
   Social: the people you ride with.

   Three tabs. Friends: who you follow, and which of them is on
   the bike right now, with a button to go and ride beside them.
   Clubs: one per rider, its tag worn next to your handle in the
   game. Ranking: the FORGE rating, the number every race moves.

   Everything here lives online, so the page says so plainly when
   there is no account, no network or no handle yet, rather than
   showing empty lists that look like nobody is there. What it
   shows of anyone is a handle, a rating and a club tag, never
   more.
   ───────────────────────────────────────────────────────────── */

type Tab = "friends" | "clubs" | "ranking";
type Gate = "loading" | "offline" | "signedOut" | "noHandle" | "ready";

const EASE = [0.16, 1, 0.3, 1] as const;

function onNetwork(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

export default function SocialPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const t = useT();
  const [tab, setTabState] = useState<Tab>("friends");
  // A new tab starts at its top: switching from far down a long list must not land in the middle of a short one.
  const tabsTop = useRef<HTMLDivElement>(null);
  const setTab = (x: Tab) => {
    setTabState(x);
    const el = tabsTop.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 8;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  };
  const [toast, setToast] = useState<string | null>(null);
  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); }, []);

  // Who is here: the account, the network and the handle, in that order.
  const [me, setMe] = useState<string | null>(null);
  const [gate, setGate] = useState<Gate>(isConfigured ? "loading" : "offline");
  const net = useSyncExternalStore(onNetwork, () => navigator.onLine, () => true);
  useEffect(() => {
    if (!isConfigured || !net) return;
    let alive = true;
    (async () => {
      const id = await myId();
      if (!alive) return;
      if (!id) { setGate("signedOut"); return; }
      setMe(id);
      const h = await getHandle();
      if (alive) setGate(h ? "ready" : "noHandle");
    })();
    return () => { alive = false; };
  }, [net]);
  const ready = gate === "ready" && net;

  // Friends: the ids both ways, and a card (handle, rating, club) for each face.
  const [followingIds, setFollowingIds] = useState<string[] | null>(null);
  const [followerIds, setFollowerIds] = useState<string[] | null>(null);
  const [cards, setCards] = useState<Map<string, RiderCard>>(new Map());
  const learn = useCallback(async (ids: string[]) => {
    const found = await profilesFor(ids);
    setCards((m) => { const next = new Map(m); for (const c of found) next.set(c.user_id, c); return next; });
  }, []);

  // Clubs: the list and mine. The ranking tab borrows the list for tag colours.
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [mine, setMine] = useState<Club | null | undefined>(undefined);
  const loadClubs = useCallback(async () => {
    const [all, my] = await Promise.all([listClubs(), myClub()]);
    setClubs(all);
    setMine(my);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // A late answer from before a sign-out or a lost connection must not land.
    let alive = true;
    (async () => {
      const [a, b, all, my] = await Promise.all([following(), followers(), listClubs(), myClub()]);
      if (!alive) return;
      setFollowingIds(a);
      setFollowerIds(b);
      setClubs(all);
      setMine(my);
      const found = await profilesFor([...a, ...b]);
      if (alive) setCards(new Map(found.map((c) => [c.user_id, c])));
    })();
    return () => { alive = false; };
  }, [ready]);

  // Who is on the bike right now.
  const [riders, setRiders] = useState<OnlineRider[]>([]);

  useEffect(() => (ready ? watchOnline(setRiders) : undefined), [ready]);

  const followSet = useMemo(() => new Set(followingIds ?? []), [followingIds]);
  const colors = useMemo(() => new Map((clubs ?? []).map((c) => [c.tag, c.color])), [clubs]);
  const ridingFriends = riders.filter((r) => followSet.has(r.user_id) && r.user_id !== me);

  async function doFollow(c: { user_id: string; handle: string }) {
    // Move first, then ask: a follow that waits for the network feels broken.
    setFollowingIds((ids) => [...new Set([...(ids ?? []), c.user_id])]);
    setCards((m) => (m.has(c.user_id) ? m : new Map(m).set(c.user_id, c)));
    if (await follow(c.user_id)) { say(t(`Tu suis @${c.handle}.`, `Following @${c.handle}.`)); void learn([c.user_id]); }
    else { setFollowingIds((ids) => (ids ?? []).filter((x) => x !== c.user_id)); say(t("Impossible de suivre pour l’instant.", "Could not follow right now.")); }
  }
  async function doUnfollow(c: { user_id: string; handle: string }) {
    setFollowingIds((ids) => (ids ?? []).filter((x) => x !== c.user_id));
    if (await unfollow(c.user_id)) say(t(`Tu ne suis plus @${c.handle}.`, `Unfollowed @${c.handle}.`));
    else { setFollowingIds((ids) => [...new Set([...(ids ?? []), c.user_id])]); say(t("Impossible pour l’instant.", "Could not do that right now.")); }
  }

  if (!profile) return <ScreenSkeleton />;
  const rating = (profile as typeof profile & { rating?: Rating }).rating;

  return (
    <Page>
      <Screen>
        <Hero image="/indoor/criterium.jpg" height="h-[320px]"
          eyebrow={t("Amis · clubs · classement", "Friends · clubs · ranking")}
          title={<>Social<br /><em>{t("roule en bande.", "ride together.")}</em></>}
          right={ready && riders.length > 0 ? (
            <span className="chip chip--live backdrop-blur-md tnum"><span className="live-dot" style={{ background: "var(--volt)" }} />{t(`${riders.length} en selle`, `${riders.length} riding`)}</span>
          ) : undefined}
          stats={ready ? [
            { label: t("Tu suis", "Following"), value: followingIds?.length ?? "—" },
            { label: t("Te suivent", "Followers"), value: followerIds?.length ?? "—" },
            { label: t("Cote FORGE", "FORGE rating"), value: rating ? Math.round(rating.value) : "—" },
          ] : undefined} />

        {!isConfigured || !net ? (
          <Offline configured={isConfigured} />
        ) : gate === "loading" ? (
          <div className="grid gap-3"><Skeleton className="h-11 rounded-full" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        ) : gate === "signedOut" ? (
          <SignedOut />
        ) : gate === "noHandle" ? (
          <div className="grid gap-4">
            <p className="text-sm text-smoke max-w-[52ch]">{t("Tes amis te trouvent par ton pseudo, et c’est lui qui s’affiche au classement et dans le jeu. Choisis-le une fois ; tu peux le changer plus tard.", "Friends find you by your handle, and it is what the ranking and the game show. Choose it once; you can change it later.")}</p>
            <HandleSetup onDone={(h) => { setGate("ready"); say(t(`T’es @${h}.`, `You are @${h}.`)); }} />
          </div>
        ) : (
          <>
            <div ref={tabsTop} aria-hidden />
            <div className="mb-6 sticky top-[calc(var(--safe-top)+8px)] z-20 lg:static">
              <div className="rounded-full bg-[rgba(243,246,242,.82)] backdrop-blur-xl">
                <Seg fill value={tab} onChange={setTab} options={[
                  { v: "friends" as Tab, label: t("Amis", "Friends") },
                  { v: "clubs" as Tab, label: "Clubs" },
                  { v: "ranking" as Tab, label: t("Classement", "Ranking") },
                ]} />
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }}>
                {tab === "friends" && (
                  <FriendsTab me={me} followingIds={followingIds} followerIds={followerIds} cards={cards} riding={ridingFriends} allRiding={riders.length}
                    colors={colors} onFollow={doFollow} onUnfollow={doUnfollow} />
                )}
                {tab === "clubs" && <ClubsTab clubs={clubs} mine={mine} reload={loadClubs} say={say} />}
                {tab === "ranking" && <RankingTab me={me} rating={rating} followingIds={followingIds} colors={colors} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </Screen>
      <Toast text={toast} />
    </Page>
  );
}

/* ── Friends ──────────────────────────────────────────────────── */

function FriendsTab({ me, followingIds, followerIds, cards, riding, allRiding, colors, onFollow, onUnfollow }: {
  me: string | null; followingIds: string[] | null; followerIds: string[] | null; cards: Map<string, RiderCard>;
  riding: OnlineRider[]; allRiding: number; colors: Map<string, string>;
  onFollow: (c: { user_id: string; handle: string }) => void; onUnfollow: (c: { user_id: string; handle: string }) => void;
}) {
  const t = useT();
  // "20 min in" keeps counting while the page stays open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  const followSet = new Set(followingIds ?? []);
  const people = (followingIds ?? []).map((id) => cards.get(id)).filter((c): c is RiderCard => !!c).sort(byRating);
  // People who follow me and I do not follow back: the likeliest friends to add.
  const back = (followerIds ?? []).filter((id) => !followSet.has(id) && id !== me).map((id) => cards.get(id)).filter((c): c is RiderCard => !!c).sort(byRating);

  return (
    <Stagger>
      <Item className="mb-[var(--stack)]">
        <StatRow items={[
          { label: t("Tu suis", "Following"), value: followingIds ? String(followingIds.length) : "—" },
          { label: t("Te suivent", "Followers"), value: followerIds ? String(followerIds.length) : "—" },
          { label: t("En selle", "Riding now"), value: String(riding.length) },
        ]} />
      </Item>

      <Item>
        <Section title={t("En selle maintenant", "Riding now")} aside={<span className="flex items-center gap-2 text-xs text-smoke tnum"><span className="live-dot" style={{ background: "var(--volt)" }} />{t(`${allRiding} en ligne`, `${allRiding} online`)}</span>}>
          {riding.length === 0 ? (
            <div className="card--flat p-5 grid gap-1">
              <p className="font-medium">{t("Personne que tu suis ne roule en ce moment.", "Nobody you follow is riding right now.")}</p>
              <p className="text-sm text-smoke max-w-[46ch]">{t("Dès qu’un ami lance une sortie dans le jeu, elle apparaît ici avec un bouton pour le rejoindre.", "As soon as a friend starts a ride in the game, it shows up here with a button to join them.")}</p>
            </div>
          ) : (
            <Stagger className="grid gap-3" delay={0.05}>
              <AnimatePresence initial={false}>
                {riding.map((r) => (
                  <motion.div key={r.user_id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35, ease: EASE }}>
                    <LiveCard rider={r} card={cards.get(r.user_id)} colors={colors} now={now} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </Stagger>
          )}
        </Section>
      </Item>

      <Item>
        <Section title={t("Tu suis", "Following")} aside={followingIds && <span className="text-xs text-smoke tnum">{followingIds.length}</span>}>
          {followingIds === null ? <RowsSkeleton n={3} /> : people.length === 0 ? (
            <div className="card--flat p-5 grid gap-1">
              <p className="font-medium">{t("Tu ne suis personne encore.", "You are not following anyone yet.")}</p>
              <p className="text-sm text-smoke max-w-[46ch]">{t("Cherche un pseudo plus bas. Suivre, c’est voir quand la personne roule et la comparer au classement.", "Search a handle below. Following someone shows you when they ride and puts them in your friends ranking.")}</p>
            </div>
          ) : (
            <ul className="card divide-y divide-line">
              <AnimatePresence initial={false}>
                {people.map((c) => (
                  <motion.li key={c.user_id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                    <PersonRow card={c} colors={colors} action={
                      <IconButton label={t(`Ne plus suivre @${c.handle}`, `Unfollow @${c.handle}`)} onClick={() => onUnfollow(c)}><UserMinus className="w-4 h-4" /></IconButton>
                    } />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Section>
      </Item>

      {back.length > 0 && (
        <Item>
          <Section title={t("Ils te suivent", "They follow you")} aside={<span className="text-xs text-smoke tnum">{back.length}</span>}>
            <ul className="card divide-y divide-line">
              {back.map((c) => (
                <li key={c.user_id}><PersonRow card={c} colors={colors} action={<FollowButton on={false} onClick={() => onFollow(c)} />} /></li>
              ))}
            </ul>
          </Section>
        </Item>
      )}

      <Item>
        <Section title={t("Trouver des cyclistes", "Find riders")}>
          <RiderSearch followSet={followSet} onFollow={onFollow} onUnfollow={onUnfollow} />
        </Section>
      </Item>
    </Stagger>
  );
}

function LiveCard({ rider, card, colors, now }: { rider: OnlineRider; card?: RiderCard; colors: Map<string, string>; now: number }) {
  const t = useT();
  const lang = useLang();
  const route = GAME_ROUTES.find((r) => r.key === rider.routeKey);
  const mins = Math.max(0, Math.round((now - Date.parse(rider.since)) / 60_000));
  return (
    <article className="card p-3 pr-3.5 flex items-center gap-3 relative overflow-hidden">
      {/* The route's own artwork, when it is one of the game's courses. */}
      <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-graphite">
        {route && <img src={route.image} alt="" aria-hidden decoding="async" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="absolute left-1.5 bottom-1.5 w-2.5 h-2.5 rounded-full bg-volt live-ping" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 grid gap-0.5">
        <span className="font-semibold truncate">@{rider.handle}</span>
        {/* The tag sits with the route, so the handle keeps the width on a phone. */}
        <div className="flex items-center gap-1.5 min-w-0">
          {card?.club_tag && <ClubTag tag={card.club_tag} color={colors.get(card.club_tag)} />}
          <span className="text-sm truncate">{route ? route.name[lang] : rider.routeName}</span>
        </div>
        <p className="text-[11px] text-smoke tnum truncate">
          <span className="text-volt font-semibold uppercase tracking-[.08em]">{t("En direct", "Live")}</span>
          {" · "}{mins < 1 ? t("à l’instant", "just started") : t(`depuis ${mins} min`, `${mins} min in`)}
        </p>
      </div>
      <Press className="shrink-0">
        <Link href={`/indoor?ride=${encodeURIComponent(rider.routeKey)}`} className="pill pill--volt pill--sm" aria-label={t(`Rejoindre @${rider.handle}`, `Join @${rider.handle}`)}>{t("Rejoindre", "Join")}</Link>
      </Press>
      <style>{`
        @keyframes social-ping { 0% { box-shadow: 0 0 0 0 rgba(184,240,58,.75) } 100% { box-shadow: 0 0 0 10px rgba(184,240,58,0) } }
        .live-ping { animation: social-ping 1.6s ease-out infinite }
        @media (prefers-reduced-motion: reduce) { .live-ping { animation: none } }
      `}</style>
    </article>
  );
}

function RiderSearch({ followSet, onFollow, onUnfollow }: { followSet: Set<string>; onFollow: (c: { user_id: string; handle: string }) => void; onUnfollow: (c: { user_id: string; handle: string }) => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; rows: { user_id: string; handle: string }[] } | null>(null);
  const clean = q.trim();

  useEffect(() => {
    if (!clean) return;
    // Wait for a pause in typing, and let only the latest answer land.
    let alive = true;
    const id = setTimeout(async () => { const rows = await findRiders(clean); if (alive) setFound({ q: clean, rows }); }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [clean]);

  const rows = clean && found?.q === clean ? found.rows : null;
  return (
    <div className="grid gap-3">
      <label className="relative block">
        <span className="sr-only">{t("Chercher un pseudo", "Search a handle")}</span>
        <Search className="w-4 h-4 text-smoke absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
        <input className="input !pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("@pseudo", "@handle")}
          autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={21} inputMode="search" enterKeyHint="search" />
      </label>
      {clean && rows === null && <RowsSkeleton n={2} />}
      {rows && rows.length === 0 && <p className="text-sm text-smoke px-1">{t(`Aucun pseudo ne commence par « ${clean} ».`, `No handle starts with “${clean}”.`)}</p>}
      {rows && rows.length > 0 && (
        <ul className="card divide-y divide-line">
          {rows.map((r) => {
            const on = followSet.has(r.user_id);
            return (
              <li key={r.user_id} className="flex items-center gap-3 px-4 py-3">
                <Avatar handle={r.handle} />
                <span className="font-medium truncate flex-1 min-w-0">@{r.handle}</span>
                <FollowButton on={on} onClick={() => (on ? onUnfollow(r) : onFollow(r))} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Clubs ────────────────────────────────────────────────────── */

function ClubsTab({ clubs, mine, reload, say }: { clubs: Club[] | null; mine: Club | null | undefined; reload: () => Promise<void>; say: (m: string) => void }) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function run(key: string, job: () => Promise<{ ok: true } | { ok: false; reason: string }>, done: string) {
    setBusy(key);
    const r = await job();
    await reload();
    setBusy(null);
    say(r.ok ? done : r.reason);
  }

  return (
    <Stagger>
      <Item>
        <Section title={t("Ton club", "Your club")}>
          {mine === undefined ? <Skeleton className="h-48" /> : mine ? (
            <MyClubCard club={mine} busy={busy}
              onLeave={() => run("leave", leaveClub, t(`Tu as quitté ${mine.name}.`, `You left ${mine.name}.`))}
              onDelete={() => run("delete", () => deleteClub(mine.id), t(`${mine.name} est supprimé.`, `${mine.name} was deleted.`))} />
          ) : (
            <div className="card--flat p-5 grid gap-1">
              <p className="font-medium">{t("Pas encore de club.", "No club yet.")}</p>
              <p className="text-sm text-smoke max-w-[46ch]">{t("Rejoins-en un plus bas ou fonde le tien. Son sigle s’affiche à côté de ton pseudo dans le jeu et au classement.", "Join one below or found your own. Its tag shows next to your handle in the game and on the ranking.")}</p>
            </div>
          )}
        </Section>
      </Item>

      <Item>
        <Section title={t("Tous les clubs", "All clubs")} aside={clubs && <span className="text-xs text-smoke tnum">{clubs.length}</span>}>
          {clubs === null ? <RowsSkeleton n={3} tall /> : clubs.length === 0 ? (
            <div className="card--flat p-5"><p className="text-sm text-smoke">{t("Aucun club encore. Le premier, c’est peut-être le tien.", "No clubs yet. The first one could be yours.")}</p></div>
          ) : (
            <ul className="card divide-y divide-line">
              {clubs.map((c) => {
                const here = mine?.id === c.id;
                const expanded = open === c.id;
                return (
                  <li key={c.id}>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <button type="button" onClick={() => setOpen(expanded ? null : c.id)} aria-expanded={expanded} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                        <ClubBadge tag={c.tag} color={c.color} size={44} />
                        <span className="grid min-w-0 flex-1">
                          <span className="font-semibold truncate">{c.name}</span>
                          <span className="text-xs text-smoke tnum truncate">{t(`${c.members} membre${c.members > 1 ? "s" : ""}`, `${c.members} member${c.members === 1 ? "" : "s"}`)}{c.about ? ` · ${c.about}` : ""}</span>
                        </span>
                        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE }} className="text-smoke shrink-0"><ChevronDown className="w-4 h-4" /></motion.span>
                      </button>
                      {here ? <span className="chip chip--volt shrink-0">{t("Ton club", "Yours")}</span> : (
                        <Press className="shrink-0">
                          <button type="button" className="pill pill--sm" disabled={!!busy}
                            onClick={() => run(`join:${c.id}`, () => joinClub(c.id), t(`Bienvenue chez ${c.name}.`, `Welcome to ${c.name}.`))}>
                            {busy === `join:${c.id}` ? "…" : t("Rejoindre", "Join")}
                          </button>
                        </Press>
                      )}
                    </div>
                    <Expand open={expanded}><div className="px-4 pb-4"><Members clubId={c.id} /></div></Expand>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </Item>

      <Item>
        <Section title={t("Créer un club", "Create a club")}>
          <CreateClub current={mine ?? null} onCreated={async (c) => { await reload(); say(t(`${c.name} est né. T’en es le fondateur.`, `${c.name} is born. You are its founder.`)); }} />
        </Section>
      </Item>
    </Stagger>
  );
}

function MyClubCard({ club, busy, onLeave, onDelete }: { club: Club; busy: string | null; onLeave: () => void; onDelete: () => void }) {
  const t = useT();
  const [members, setMembers] = useState<{ id: string; rows: RiderCard[] } | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let alive = true;
    clubMembers(club.id).then((rows) => { if (alive) setMembers({ id: club.id, rows }); });
    return () => { alive = false; };
  }, [club.id, club.members]);
  const rows = members?.id === club.id ? members.rows : null;
  const avg = rows ? averageRating(rows) : null;

  return (
    <div className="card overflow-hidden">
      {/* A band of the club's colour: the jersey, in one stripe. */}
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${club.color}, ${club.color}88)` }} />
      <div className="p-5 grid gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <ClubBadge tag={club.tag} color={club.color} size={64} />
          <div className="min-w-0">
            <p className="display text-2xl leading-tight line-clamp-2 break-words">{club.name}</p>
            {club.owned && <p className="text-xs text-smoke flex items-center gap-1 mt-1"><Crown className="w-3.5 h-3.5 text-volt" />{t("Tu l’as fondé", "You founded it")}</p>}
          </div>
        </div>
        {club.about && <p className="text-sm text-smoke">{club.about}</p>}
        <StatRow items={[
          { label: t("Membres", "Members"), value: String(club.members) },
          { label: t("Cote moyenne", "Avg rating"), value: rows === null ? "…" : avg === null ? "—" : String(avg) },
        ]} />
        <div className="flex flex-wrap gap-2">
          <Press><button type="button" className="pill pill--sm" onClick={() => setShowMembers((v) => !v)} aria-expanded={showMembers}>
            {showMembers ? t("Masquer les membres", "Hide members") : t("Voir les membres", "See members")}
          </button></Press>
          <Press><button type="button" className="pill pill--sm" disabled={!!busy} onClick={onLeave}><LogOut className="w-4 h-4" />{t("Quitter", "Leave")}</button></Press>
          {club.owned && (
            // Deleting a club removes everyone's membership: ask twice.
            <Press><button type="button" className="pill pill--sm pill--danger" disabled={!!busy}
              onClick={() => { if (confirm) onDelete(); else { setConfirm(true); setTimeout(() => setConfirm(false), 4000); } }}>
              <Trash2 className="w-4 h-4" />{confirm ? t("Confirmer la suppression", "Confirm delete") : t("Supprimer", "Delete")}
            </button></Press>
          )}
        </div>
        <Expand open={showMembers}><Members clubId={club.id} rows={rows} /></Expand>
      </div>
    </div>
  );
}

/** A club's riders, strongest first. Loads its own list unless handed one. */
function Members({ clubId, rows }: { clubId: string; rows?: RiderCard[] | null }) {
  const t = useT();
  const [own, setOwn] = useState<RiderCard[] | null>(null);
  useEffect(() => {
    if (rows !== undefined) return;
    let alive = true;
    clubMembers(clubId).then((r) => { if (alive) setOwn(r); });
    return () => { alive = false; };
  }, [clubId, rows]);
  const list = rows !== undefined ? rows : own;
  if (list === null) return <RowsSkeleton n={2} />;
  if (!list.length) return <p className="text-sm text-smoke">{t("Aucun membre avec un pseudo public.", "No member with a public handle.")}</p>;
  return (
    <ol className="rounded-2xl bg-graphite/60 divide-y divide-line">
      {list.map((m, i) => (
        <li key={m.user_id} className="flex items-center gap-3 px-3 py-2.5">
          <span className="w-5 text-xs text-smoke tnum text-right shrink-0">{i + 1}</span>
          <Avatar handle={m.handle} size={32} />
          <span className="text-sm font-medium truncate flex-1 min-w-0">@{m.handle}</span>
          {m.rating != null ? <RatingPair value={m.rating} /> : <span className="text-xs text-smoke">{t("Pas classé", "Unrated")}</span>}
        </li>
      ))}
    </ol>
  );
}

function CreateClub({ current, onCreated }: { current: Club | null; onCreated: (c: Club) => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [color, setColor] = useState<string>(CLUB_COLORS[0]);
  const [about, setAbout] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const touched = name.trim().length > 0 || tag.trim().length > 0;
  const problem = touched ? clubProblem({ name, tag, about, color }) : null;
  const shownTag = normalTag(tag) || "TAG";
  const said = name.trim() && tag.trim() ? problem : null;

  async function save() {
    setBusy(true);
    setError(null);
    const r = await createClub({ name, tag, color, about });
    setBusy(false);
    if (!r.ok) { setError(r.reason); return; }
    setName(""); setTag(""); setAbout("");
    onCreated(r.value);
  }

  return (
    <div className="card p-5 grid gap-5">
      {/* The club as it will look, before it exists. */}
      <div className="flex items-center gap-4 min-w-0">
        <motion.div key={color} initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
          <ClubBadge tag={shownTag} color={color} size={56} />
        </motion.div>
        <div className="min-w-0">
          <p className="display text-xl leading-tight truncate">{name.trim() || t("Ton club", "Your club")}</p>
          <p className="text-xs text-smoke mt-0.5">{t("Aperçu : ton sigle à côté de ton pseudo.", "Preview: your tag next to your handle.")}</p>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
        <label className="field min-w-0">
          <span className="meta">{t("Nom", "Name")}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder={t("Les Grimpeurs", "Hill Climbers")} autoComplete="off" />
        </label>
        <label className="field">
          <span className="meta">{t("Sigle", "Tag")}</span>
          <input className="input font-mono uppercase tracking-[.12em] text-center" value={tag} onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            maxLength={4} placeholder="GRMP" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        </label>
      </div>

      <fieldset className="field">
        <legend className="meta mb-2">{t("Couleur", "Colour")}</legend>
        <div role="radiogroup" aria-label={t("Couleur du club", "Club colour")} className="grid grid-cols-6 gap-2 max-w-[330px]">
          {CLUB_COLORS.map((c) => {
            const on = c === color;
            return (
              <button key={c} type="button" role="radio" aria-checked={on} aria-label={c} onClick={() => setColor(c)}
                className="aspect-square w-full min-h-10 rounded-full grid place-items-center transition-transform active:scale-95"
                style={{ background: c, boxShadow: on ? `0 0 0 3px var(--carbon), 0 0 0 5px ${c}` : "inset 0 0 0 1px rgba(0,0,0,.08)" }}>
                {on && <motion.span layoutId="swatch-dot" className="w-2.5 h-2.5 rounded-full" style={{ background: inkOn(c) }} />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="field">
        <span className="meta flex justify-between"><span>{t("En deux mots", "In a few words")}</span><span className="tnum">{about.length}/160</span></span>
        <textarea className="input min-h-[84px] py-3 resize-none" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={160}
          placeholder={t("Sorties du dimanche, cols et café.", "Sunday rides, climbs and coffee.")} />
      </label>

      {/* Not a word while the second field is still empty: it has not been answered wrong yet. */}
      {(said || error) && <p className="text-xs text-danger">{said ?? error}</p>}
      {current && <p className="text-xs text-smoke">{t(`Créer un club te fait quitter ${current.name}.`, `Creating a club makes you leave ${current.name}.`)}</p>}

      <Press className="justify-self-start">
        <button type="button" className="pill pill--volt" disabled={!touched || !!problem || busy} onClick={save}>
          {busy ? t("Création…", "Creating…") : t("Créer le club", "Create the club")}
        </button>
      </Press>
    </div>
  );
}

/* ── Ranking ──────────────────────────────────────────────────── */

function RankingTab({ me, rating, followingIds, colors }: { me: string | null; rating?: Rating; followingIds: string[] | null; colors: Map<string, string> }) {
  const t = useT();
  const [scope, setScope] = useState<"world" | "friends">("world");
  const [board, setBoard] = useState<{ scope: string; rows: RatingRow[] } | null>(null);
  const [place, setPlace] = useState<{ place: number; of: number } | null>(null);
  const friendsKey = (followingIds ?? []).join(",");

  useEffect(() => {
    let alive = true;
    const only = scope === "friends" ? [...(followingIds ?? []), ...(me ? [me] : [])] : undefined;
    ratingBoard(50, only).then((rows) => { if (alive) setBoard({ scope, rows }); });
    return () => { alive = false; };
    // followingIds is read through its joined key, so a new array with the same people does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, friendsKey, me]);

  const value = rating ? Math.round(rating.value) : null;
  useEffect(() => {
    if (value == null) return;
    let alive = true;
    ratingPlace(value).then((p) => { if (alive) setPlace(p); });
    return () => { alive = false; };
  }, [value]);

  const rows = board?.scope === scope ? board.rows : null;
  const mineShown = !!rows?.some((r) => r.user_id === me);

  return (
    <Stagger>
      <Item>
        <Section title={t("Ta cote FORGE", "Your FORGE rating")}>
          {rating ? <RatingCard rating={rating} place={place} /> : (
            <div className="card--photo">
              <img src="/indoor/giant.jpg" alt="" aria-hidden decoding="async" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07090d] via-[#07090d]/80 to-[#07090d]/15" />
              <div className="card__body p-5 pt-32 grid gap-3">
                <p className="display text-3xl leading-none">{t("Pas encore", "No rating")} <em>{t("de cote.", "yet.")}</em></p>
                <p className="text-sm text-bone/75 max-w-[42ch]">{t("Ta cote FORGE naît de tes courses dans le jeu : Événements → Course. Chaque place la fait bouger, et les cinq premières courses comptent double.", "Your FORGE rating comes from races in the game: Events → Race. Every finish moves it, and your first five races count double.")}</p>
                <Link href="/indoor" className="pill pill--volt pill--sm justify-self-start">{t("Aller courir", "Go race")}</Link>
              </div>
            </div>
          )}
        </Section>
      </Item>

      <Item>
        <Section title={t("Classement", "Ranking")} aside={<span className="text-xs text-smoke">{t("top 50", "top 50")}</span>}>
          <div className="mb-4"><Seg value={scope} onChange={setScope} options={[{ v: "world" as const, label: t("Monde", "World") }, { v: "friends" as const, label: t("Mes amis", "Friends") }]} /></div>
          {rows === null ? <RowsSkeleton n={6} /> : rows.length === 0 ? (
            <div className="card--flat p-5 grid gap-1">
              <p className="font-medium">{scope === "friends" ? t("Personne de classé parmi tes amis.", "Nobody rated among your friends.") : t("Le classement est vide.", "The ranking is empty.")}</p>
              <p className="text-sm text-smoke max-w-[46ch]">{scope === "friends" ? t("Suis des cyclistes dans l’onglet Amis ; ceux qui ont couru apparaissent ici.", "Follow riders in the Friends tab; those who have raced show up here.") : t("La première course terminée ouvre le bal.", "The first finished race opens the board.")}</p>
            </div>
          ) : (
            <ol className="card divide-y divide-line overflow-hidden">
              {rows.map((r, i) => <BoardRow key={r.user_id} rank={i + 1} row={r} mine={r.user_id === me} color={r.club_tag ? colors.get(r.club_tag) : undefined} />)}
              {/* Outside the top 50 in the world: still show where I stand. */}
              {scope === "world" && !mineShown && rating && place && place.place > rows.length && (
                <>
                  <li className="text-center text-smoke text-xs py-1.5 tracking-[.3em]" aria-hidden>···</li>
                  <li className="flex items-center gap-3 px-4 py-3 bg-[rgba(31,199,111,.10)]">
                    <span className="w-8 text-sm font-semibold tnum text-right shrink-0">{place.place}</span>
                    <span className="flex-1 font-semibold">{t("Toi", "You")}</span>
                    <RatingPair value={Math.round(rating.value)} />
                  </li>
                </>
              )}
            </ol>
          )}
        </Section>
      </Item>
    </Stagger>
  );
}

function RatingCard({ rating, place }: { rating: Rating; place: { place: number; of: number } | null }) {
  const t = useT();
  const lang = useLang();
  const value = Math.round(rating.value);
  return (
    <div className="card--photo">
      <img src="/indoor/alpine.jpg" alt="" aria-hidden decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07090d] via-[#07090d]/80 to-[#07090d]/40" />
      <div className="card__body p-5 grid gap-5">
        <div className="flex items-end justify-between gap-3">
          <div className="grid gap-2">
            <span className="chip chip--volt justify-self-start">{ratingTier(value, lang === "en")}</span>
            <strong className="numeral !text-[clamp(3.2rem,16vw,4.6rem)] leading-none text-bone"><CountUp value={value} /></strong>
          </div>
          {place && (
            <div className="text-right grid">
              <span className="meta">{t("Au monde", "Worldwide")}</span>
              <span className="display text-3xl tnum leading-none mt-1">#{place.place}</span>
              <span className="text-xs text-bone/70 tnum">{t(`sur ${place.of}`, `of ${place.of}`)}</span>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
          <div className="grid gap-1"><dt className="meta">{t("Courses", "Races")}</dt><dd className="numeral !text-2xl leading-none tnum">{rating.races}</dd></div>
          <div className="grid gap-1"><dt className="meta">{t("Meilleure", "Best")}</dt><dd className="numeral !text-2xl leading-none tnum">{Math.round(rating.best)}</dd></div>
        </dl>
        {rating.history.length > 0 && (
          <div className="grid gap-2">
            <span className="meta">{t("Dernières courses", "Last races")}</span>
            <div className="flex flex-wrap gap-1.5">
              {rating.history.map((h, i) => (
                <motion.span key={h.at + i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04, duration: 0.4, ease: EASE }}
                  title={t(`${h.place}e sur ${h.of} · cat. ${h.category}`, `${h.place} of ${h.of} · cat. ${h.category}`)}
                  className={`inline-flex items-center h-7 px-2.5 rounded-full text-xs font-bold tnum ${h.delta > 0 ? "bg-volt text-[#06240f]" : h.delta < 0 ? "bg-[rgba(217,69,61,.9)] text-white" : "bg-white/15 text-bone"}`}>
                  {h.delta > 0 ? "+" : h.delta < 0 ? "−" : "±"}{Math.abs(h.delta)}
                </motion.span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BoardRow({ rank, row, mine, color }: { rank: number; row: RatingRow; mine: boolean; color?: string }) {
  const t = useT();
  const podium = ["#E8B931", "#AEB6BF", "#C8834A"][rank - 1];
  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${mine ? "bg-[rgba(31,199,111,.10)] shadow-[inset_3px_0_0_var(--volt-deep)]" : ""}`}>
      <span className="w-8 shrink-0 grid place-items-center">
        {podium ? <span className="w-7 h-7 rounded-full grid place-items-center text-xs font-bold tnum text-white" style={{ background: podium }}>{rank}</span>
          : <span className="text-sm text-smoke tnum">{rank}</span>}
      </span>
      <div className="min-w-0 flex-1 grid gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`truncate ${mine ? "font-bold" : "font-semibold"}`}>@{row.handle}</span>
          {mine && <span className="chip chip--volt !py-0.5 shrink-0">{t("Toi", "You")}</span>}
        </div>
        <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-smoke tnum">
          {row.club_tag && <ClubTag tag={row.club_tag} color={color} />}
          <span className="truncate">{t("Cat.", "Cat.")} {row.category} · {t(`${row.races} course${row.races > 1 ? "s" : ""}`, `${row.races} race${row.races === 1 ? "" : "s"}`)}</span>
        </span>
      </div>
      <RatingPair value={row.rating} />
    </li>
  );
}

/* ── Small parts ──────────────────────────────────────────────── */

function PersonRow({ card, colors, action }: { card: RiderCard; colors: Map<string, string>; action: ReactNode }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar handle={card.handle} />
      <div className="min-w-0 flex-1 grid gap-0.5">
        <span className="font-semibold truncate">@{card.handle}</span>
        <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-smoke tnum">
          {card.club_tag && <ClubTag tag={card.club_tag} color={colors.get(card.club_tag)} />}
          <span className="truncate">{card.rating != null ? <>{t("Cat.", "Cat.")} {card.category} · {t(`${card.races} course${(card.races ?? 0) > 1 ? "s" : ""}`, `${card.races} race${card.races === 1 ? "" : "s"}`)}</> : t("Pas encore classé", "Not rated yet")}</span>
        </span>
      </div>
      {card.rating != null && <RatingPair value={card.rating} />}
      {action}
    </div>
  );
}

/** The number and its tier, stacked, right-aligned. */
function RatingPair({ value }: { value: number }) {
  const lang = useLang();
  const top = value >= 1600;
  return (
    <span className="grid justify-items-end leading-none shrink-0">
      <strong className="numeral !text-lg tnum">{value}</strong>
      <span className={`text-[10px] uppercase tracking-[.1em] mt-1 font-semibold ${top ? "text-volt" : "text-smoke"}`}>{ratingTier(value, lang === "en")}</span>
    </span>
  );
}

/** A handle's face: its first letter on a colour of its own, the same on every device. */
function Avatar({ handle, size = 40 }: { handle: string; size?: number }) {
  let h = 0;
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span aria-hidden className="rounded-full grid place-items-center font-bold shrink-0 text-[#06240f]"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(140deg, hsl(${h} 85% 78%), hsl(${(h + 40) % 360} 80% 64%))` }}>
      {handle.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ClubBadge({ tag, color, size }: { tag: string; color: string; size: number }) {
  return (
    <span aria-hidden className="rounded-2xl grid place-items-center font-mono font-bold tracking-[.06em] shrink-0 shadow-[0_10px_24px_-14px_rgba(0,0,0,.6)]"
      style={{ width: size, height: size, background: color, color: inkOn(color), fontSize: size * (tag.length > 3 ? 0.24 : 0.3) }}>
      {tag}
    </span>
  );
}

/** A tag next to a handle, as the game shows it. */
function ClubTag({ tag, color }: { tag: string; color?: string }) {
  const bg = color ?? "var(--ink)";
  return <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-md font-mono text-[10px] font-bold tracking-[.08em]" style={{ background: bg, color: color ? inkOn(color) : "var(--bone)" }}>{tag}</span>;
}

function FollowButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <Press className="shrink-0">
      <button type="button" onClick={onClick} aria-pressed={on}
        className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border text-sm font-semibold transition-colors ${on ? "bg-ink border-ink text-bone" : "bg-volt border-volt text-[#06240f]"}`}>
        {on ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
        {on ? t("Suivi", "Following") : t("Suivre", "Follow")}
      </button>
    </Press>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Press className="shrink-0">
      <button type="button" onClick={onClick} aria-label={label} title={label}
        className="w-10 h-10 rounded-full border border-line-strong grid place-items-center text-smoke hover:text-danger hover:border-danger transition-colors">
        {children}
      </button>
    </Press>
  );
}

/** Opens in place, measuring its own height. */
function Expand({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RowsSkeleton({ n, tall }: { n: number; tall?: boolean }) {
  return <div className="grid gap-2">{Array.from({ length: n }, (_, i) => i).map((i) => <Skeleton key={i} className={tall ? "h-[72px]" : "h-14"} />)}</div>;
}

/* ── Gates ────────────────────────────────────────────────────── */

function Offline({ configured }: { configured: boolean }) {
  const t = useT();
  return (
    <div className="card p-6 grid gap-3">
      <span className="w-11 h-11 rounded-full bg-graphite grid place-items-center"><WifiOff className="w-5 h-5 text-smoke" /></span>
      <p className="display text-2xl">{t("Le social a besoin du compte en ligne", "Social needs the online account")}</p>
      <p className="text-sm text-smoke max-w-[52ch]">
        {configured
          ? t("T’es hors ligne. Amis, clubs et classement reviennent dès que la connexion revient ; tout le reste de l’app continue de fonctionner.", "You are offline. Friends, clubs and the ranking come back with the connection; everything else in the app keeps working.")
          : t("Tout le reste de l’app fonctionne hors ligne et va toujours fonctionner. Les amis, les clubs et le classement, non : ils vivent en ligne. Ajoute tes clés Supabase et connecte-toi dans les Réglages.", "Everything else in the app works offline and always will. Friends, clubs and the ranking cannot: they live online. Add your Supabase keys and sign in from Settings.")}
      </p>
    </div>
  );
}

function SignedOut() {
  const t = useT();
  return (
    <div className="card p-6 grid gap-3">
      <p className="display text-2xl">{t("Connecte-toi pour rouler en bande", "Sign in to ride with others")}</p>
      <p className="text-sm text-smoke max-w-[52ch]">{t("Les amis, les clubs et le classement ont besoin du compte en ligne. Ton entraînement, lui, reste sur ton appareil.", "Friends, clubs and the ranking need the online account. Your training stays on your device.")}</p>
      <Link href="/settings" className="pill pill--volt pill--sm justify-self-start">{t("Se connecter", "Sign in")}</Link>
    </div>
  );
}
