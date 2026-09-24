"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { isConfigured } from "@/lib/supabase/client";
import { publish, unpublish, getHandle } from "@/lib/social/feed";
import { publishableRoute, TRIM_M } from "@/lib/social/privacy";
import { shareActivity, unshareActivity } from "@/lib/progress";
import { RouteThumb } from "./RouteThumb";
import { HandleSetup } from "./HandleSetup";
import { Press } from "./motion";
import type { Activity } from "@/lib/types";
import { useT } from "@/lib/i18n";

/* ─────────────────────────────────────────────────────────────
   Posting is a decision, so it gets a moment.

   The sheet is not a legal notice nobody reads — it draws the
   route that will actually be published, next to the one that was
   recorded, so the trim is something you can see rather than
   something you are asked to believe.
   ───────────────────────────────────────────────────────────── */

export function PostToFeed({ activity, say }: { activity: Activity; say: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const t = useT();

  if (!isConfigured) return null;

  async function openSheet() {
    setOpen(true);
    if (!checked) { setHandle(await getHandle()); setChecked(true); }
  }

  async function post() {
    setBusy(true);
    const r = await publish(activity);
    if (r.ok) {
      const xp = await shareActivity(activity.id);
      setOpen(false);
      say(xp ? t(`Publié dans le fil. +${xp} XP.`, `Posted to the feed. +${xp} XP.`) : t("Publié dans le fil.", "Posted to the feed."));
    } else {
      say(r.reason);
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const r = await unpublish(activity.id);
    if (r.ok) { await unshareActivity(activity.id); say(t("Retiré du fil.", "Removed from the feed.")); }
    else say(r.reason);
    setBusy(false);
  }

  if (activity.shared) {
    return <Press><button type="button" className="pill" disabled={busy} onClick={remove}>{busy ? t("Retrait…", "Removing…") : t("Retirer du fil", "Remove from feed")}</button></Press>;
  }

  return (
    <>
      <Press><button type="button" className="pill" onClick={openSheet}>{t("Publier dans le fil", "Post to feed")}</button></Press>
      <AnimatePresence>{open && <Sheet activity={activity} handle={handle} busy={busy} onHandle={setHandle} onPost={post} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Sheet({ activity, handle, busy, onHandle, onPost, onClose }: {
  activity: Activity; handle: string | null; busy: boolean;
  onHandle: (h: string) => void; onPost: () => void; onClose: () => void;
}) {
  const { route, cell } = publishableRoute(activity.points);
  const recorded = activity.points.map((p) => [p.lat, p.lng] as [number, number]);
  const tooShort = route.length < 2 && recorded.length > 1;
  const t = useT();

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label={t("Publier dans le fil", "Post to the feed")}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center bg-[rgba(8,9,10,.55)] backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        className="card w-full sm:max-w-[460px] p-5 grid gap-4 rounded-b-none sm:rounded-3xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid gap-1">
          <span className="eyebrow">{t("Avant de publier", "Before you post")}</span>
          <p className="display text-2xl leading-tight">{t("Voici ce que les gens vont voir.", "This is what people will see.")}</p>
        </div>

        {!handle ? (
          <HandleSetup onDone={onHandle} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <figure className="grid gap-2">
                <div className="card p-2 text-smoke"><RouteThumb route={recorded} className="w-full h-[110px]" /></div>
                <figcaption className="meta text-center">{t("Ce que t’as enregistré", "What you recorded")}</figcaption>
              </figure>
              <figure className="grid gap-2">
                <div className="card p-2 text-volt !border-volt"><RouteThumb route={route} className="w-full h-[110px]" /></div>
                <figcaption className="meta text-center">{t("Ce qui est publié", "What gets published")}</figcaption>
              </figure>
            </div>

            <ul className="grid gap-1.5 text-xs text-smoke">
              <li>· {t(`Les ${TRIM_M} premiers et derniers mètres sont coupés, pour que la ligne commence pas chez vous.`, `The first and last ${TRIM_M} m are cut off, so the line does not start where you do.`)}</li>
              <li>· {t("Classé dans une zone de plusieurs kilomètres de large", "Filed under an area several kilometers wide")}{cell ? "" : t(" selon ta dernière activité enregistrée", " from your last recorded activity")}{t(", jamais une coordonnée.", " — never a coordinate.")}</li>
              <li>· {t("Publié en tant que", "Posted as")} <strong className="text-ink">@{handle}</strong>{t(", avec ta distance, ton temps et ton dénivelé. Pas d’heure, d’altitude ni de fréquence cardiaque.", ", with your distance, time and climb. No timestamps, altitude or heart rate.")}</li>
              <li>· {t("Tu peux la retirer n’importe quand, et elle disparaît pour tout le monde.", "You can take it down at any time, and it is gone for everyone.")}</li>
            </ul>

            {tooShort && (
              <p className="text-xs text-danger">
                {t("Ce parcours est trop court pour être publié sans risque : une fois coupé aux deux bouts, il reste juste le coin de rue où il a commencé. Si tu le publies, il apparaît sans carte.", "This route is too short to publish safely — trimmed at both ends there is nothing left but the block it started on. Post it and it appears without a map.")}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Press><button type="button" className="pill pill--sm" onClick={onClose}>{t("Annuler", "Cancel")}</button></Press>
              <Press><button type="button" className="pill pill--volt pill--sm" disabled={busy} onClick={onPost}>{busy ? t("Publication…", "Posting…") : t("Publier", "Post it")}</button></Press>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
