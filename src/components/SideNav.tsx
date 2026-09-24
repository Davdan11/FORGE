"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { CalendarDays, Settings } from "lucide-react";
import { FeedIcon, FoodIcon, IndoorIcon, LibraryIcon, MoveIcon, ProfileIcon, TodayIcon, type NavIcon } from "./NavIcons";
import { locale, useT } from "@/lib/i18n";
import { getProfile, getStats } from "@/lib/db";
import { subRankFor, tierForLevel } from "@/lib/gamification";
import { RankEmblem } from "./RankEmblem";
import { levelFromXp, rankFor } from "@/lib/gamification";

/* Desktop shell navigation (≥ lg). Mirrors BottomNav items. */
const ITEMS: { href: string; label: string; fr: string; icon: NavIcon }[] = [
  { href: "/today", label: "Today", fr: "Aujourd'hui", icon: TodayIcon },
  { href: "/library", label: "Library", fr: "Bibliothèque", icon: LibraryIcon },
  { href: "/move", label: "Move", fr: "Bouge", icon: MoveIcon },
  { href: "/indoor", label: "Indoor", fr: "Indoor", icon: IndoorIcon },
  { href: "/food", label: "Food", fr: "Bouffe", icon: FoodIcon },
  { href: "/progress", label: "Profile", fr: "Profil", icon: ProfileIcon },
  { href: "/feed", label: "Feed", fr: "Fil", icon: FeedIcon },
  { href: "/plan", label: "Block", fr: "Bloc", icon: CalendarDays },
  { href: "/settings", label: "Settings", fr: "Réglages", icon: Settings },
];

export function SideNav() {
  const path = usePathname();
  const t = useT();
  const profile = useLiveQuery(() => getProfile(), []);
  const stats = useLiveQuery(() => getStats(), []);
  const lvl = stats ? levelFromXp(stats.xp) : null;
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[240px] flex-col border-r border-line bg-[rgba(255,255,255,.85)] backdrop-blur-xl px-5 py-7 z-30">
      <Link href="/today" className="display text-[1.55rem] tracking-[.06em] leading-none mb-10 px-2">FORGE<span className="text-volt">.</span></Link>
      <ul className="grid gap-1">
        {ITEMS.map((it) => {
          const on = path === it.href || path.startsWith(it.href + "/") || (it.href === "/today" && path.startsWith("/session"));
          return (
            <li key={it.href} className="relative">
              {on && <motion.span layoutId="side-pill" className="absolute inset-0 rounded-[var(--r-control)] bg-carbon border border-line shadow-[var(--e2)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Link href={it.href} aria-current={on ? "page" : undefined} className={`relative flex items-center gap-3 px-3 h-11 rounded-2xl text-[13px] tracking-wide transition-colors ${on ? "text-volt" : "text-smoke hover:text-ink"}`}>
                <it.icon className="w-5 h-5" strokeWidth={on ? 2 : 1.7} aria-hidden="true" />
                {t(it.fr, it.label)}
              </Link>
            </li>
          );
        })}
      </ul>
      {profile && lvl && (
        // The rank the athlete has earned belongs next to their name, not a
        // bare progress ring. Progress moves to the bar underneath.
        <Link href="/ranks" className="mt-auto grid gap-2 px-2 min-w-0">
          <span className="flex items-center gap-3 min-w-0">
            <RankEmblem tier={tierForLevel(lvl.level)} sub={subRankFor(lvl.level)} size={40} className="shrink-0" />
            <span className="grid leading-tight min-w-0">
              <span className="text-sm font-medium truncate">{profile.name}</span>
              <span className="text-[11px] text-smoke truncate">{rankFor(lvl.level)} · {t("niveau", "level")} {lvl.level}</span>
            </span>
          </span>
          <span className="grid gap-1">
            <span className="bar"><i style={{ width: `${(lvl.into / lvl.need) * 100}%` }} /></span>
            <span className="text-[10px] text-smoke tnum">{lvl.into.toLocaleString(locale())} / {lvl.need.toLocaleString(locale())} XP</span>
          </span>
        </Link>
      )}
    </aside>
  );
}
