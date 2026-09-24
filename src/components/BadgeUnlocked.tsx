"use client";

import { useEffect, useState } from "react";
import { BADGES, badgeDesc, badgeName } from "@/lib/gamification";
import { useLang, useT } from "@/lib/i18n";
import { BADGES_EVENT } from "@/lib/progress";
import { BadgeEmblem } from "./BadgeEmblem";
import { AnimatePresence, motion } from "@/components/motion";

/*
 * A badge earned is worth a moment: a card drops in from the top with the
 * badge, its name and what it took, then leaves on its own. Several at once
 * play one after another. Fired by the award path (lib/progress.ts), so a
 * weigh-in, a finished week or a logged meal all get it.
 */
export function BadgeUnlocked() {
  const [queue, setQueue] = useState<string[]>([]);
  const t = useT();
  const lang = useLang();

  useEffect(() => {
    const on = (e: Event) => {
      setQueue((q) => [...q, ...(e as CustomEvent<string[]>).detail]);
      navigator.vibrate?.([20, 40, 60]);
    };
    window.addEventListener(BADGES_EVENT, on);
    return () => window.removeEventListener(BADGES_EVENT, on);
  }, []);

  const id = queue[0];
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 4200);
    return () => clearTimeout(t);
  }, [id]);

  const badge = BADGES.find((b) => b.id === id);
  return (
    <div className="fixed inset-x-0 top-[calc(var(--safe-top)+12px)] z-[66] grid justify-items-center px-4 pointer-events-none">
      <AnimatePresence mode="wait">
        {badge && (
          <motion.button key={badge.id} type="button" onClick={() => setQueue((q) => q.slice(1))}
            className="pointer-events-auto w-full max-w-[420px] card p-3 pr-4 flex items-center gap-3 text-left"
            initial={{ y: -90, opacity: 0, scale: 0.92 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}>
            <motion.span initial={{ rotate: -25, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.15 }}>
              <BadgeEmblem id={badge.id} pillar={badge.pillar} earned size={56} />
            </motion.span>
            <span className="min-w-0 grid">
              <span className="meta text-volt font-bold">{t("Badge débloqué", "Badge unlocked")}</span>
              <strong className="display text-lg leading-tight truncate">{badgeName(badge, lang)}</strong>
              <span className="text-xs text-smoke">{badgeDesc(badge, lang)}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
