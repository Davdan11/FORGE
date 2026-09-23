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
      say(xp ? `Posted to the feed. +${xp} XP.` : "Posted to the feed.");
    } else {
      say(r.reason);
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const r = await unpublish(activity.id);
    if (r.ok) { await unshareActivity(activity.id); say("Removed from the feed."); }
    else say(r.reason);
    setBusy(false);
  }

  if (activity.shared) {
    return <Press><button type="button" className="pill" disabled={busy} onClick={remove}>{busy ? "Removing…" : "Remove from feed"}</button></Press>;
  }

  return (
    <>
      <Press><button type="button" className="pill" onClick={openSheet}>Post to feed</button></Press>
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

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label="Post to the feed"
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
          <span className="eyebrow">Before you post</span>
          <p className="display text-2xl leading-tight">This is what people will see.</p>
        </div>

        {!handle ? (
          <HandleSetup onDone={onHandle} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <figure className="grid gap-2">
                <div className="card p-2 text-smoke"><RouteThumb route={recorded} className="w-full h-[110px]" /></div>
                <figcaption className="meta text-center">What you recorded</figcaption>
              </figure>
              <figure className="grid gap-2">
                <div className="card p-2 text-volt !border-volt"><RouteThumb route={route} className="w-full h-[110px]" /></div>
                <figcaption className="meta text-center">What gets published</figcaption>
              </figure>
            </div>

            <ul className="grid gap-1.5 text-xs text-smoke">
              <li>· The first and last {TRIM_M} m are cut off, so the line does not start where you do.</li>
              <li>· Filed under an area several kilometers wide{cell ? "" : " from your last recorded activity"} — never a coordinate.</li>
              <li>· Posted as <strong className="text-ink">@{handle}</strong>, with your distance, time and climb. No timestamps, altitude or heart rate.</li>
              <li>· You can take it down at any time, and it is gone for everyone.</li>
            </ul>

            {tooShort && (
              <p className="text-xs text-danger">
                This route is too short to publish safely — trimmed at both ends there is nothing left but the block it started on. Post it and it appears without a map.
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Press><button type="button" className="pill pill--sm" onClick={onClose}>Cancel</button></Press>
              <Press><button type="button" className="pill pill--volt pill--sm" disabled={busy} onClick={onPost}>{busy ? "Posting…" : "Post it"}</button></Press>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
