"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useT } from "@/lib/i18n";
import { FoodIcon, IndoorIcon, MoveIcon, ProfileIcon, TodayIcon, type NavIcon } from "./NavIcons";

/* Five tabs: at six and more the labels shrank and the bar read as a list of everything. Today (with the session,
   the block and the calendar), Move (outdoor GPS and the exercise library, switched at the top of both), Indoor (the
   ride game), Food, and Me (profile, feed, social, ranks, settings). The desktop side nav still lists everything. */
const ITEMS: { href: string; label: string; fr: string; icon: NavIcon; also: string[] }[] = [
  { href: "/today", label: "Today", fr: "Auj.", icon: TodayIcon, also: ["/session", "/plan", "/calendar"] },
  { href: "/move", label: "Move", fr: "Bouge", icon: MoveIcon, also: ["/library"] },
  { href: "/indoor", label: "Ride", fr: "Rouler", icon: IndoorIcon, also: [] },
  { href: "/food", label: "Food", fr: "Bouffe", icon: FoodIcon, also: [] },
  { href: "/progress", label: "Me", fr: "Moi", icon: ProfileIcon, also: ["/feed", "/social", "/settings", "/ranks", "/trends", "/journey", "/admin"] },
];

export function BottomNav() {
  const path = usePathname();
  const t = useT();
  return (
    <nav aria-label={t("Application", "App")} className="nav-float">
      <ul className="flex">
        {ITEMS.map((it) => {
          const on = [it.href, ...it.also].some((h) => path === h || path.startsWith(h + "/"));
          return (
            <li key={it.href} className="flex-1 relative">
              {on && <motion.span layoutId="nav-pill" className="absolute inset-x-2 top-1.5 h-9 rounded-[14px] shadow-[0_8px_20px_-6px_rgba(255,46,120,.7)]" style={{ background: "var(--grad)" }} transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Link href={it.href} aria-current={on ? "page" : undefined} onClick={() => navigator.vibrate?.(6)} className={`relative grid justify-items-center gap-1 py-2.5 text-[11px] tracking-[.06em] uppercase transition-colors ${on ? "text-ink font-semibold" : "text-smoke"}`}>
                <motion.span animate={{ scale: on ? 1.1 : 1, y: on ? -1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="grid place-items-center" aria-hidden="true"><it.icon className="w-6 h-6" strokeWidth={on ? 2 : 1.7} /></motion.span>
                {t(it.fr, it.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
