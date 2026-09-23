"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { FoodIcon, LibraryIcon, MoveIcon, ProfileIcon, TodayIcon, type NavIcon } from "./NavIcons";

/* Five tabs, not seven: at seven the labels shrank to 10 px and the targets
   to a sliver. Indoor lives inside Move (its "Indoor" button) and the feed
   inside Profile (its "Feed" tab); both keep their tab lit. The desktop
   side nav still lists everything. */
const ITEMS: { href: string; label: string; icon: NavIcon; also: string[] }[] = [
  { href: "/today", label: "Today", icon: TodayIcon, also: ["/session", "/plan"] },
  { href: "/library", label: "Library", icon: LibraryIcon, also: [] },
  { href: "/move", label: "Move", icon: MoveIcon, also: ["/indoor"] },
  { href: "/food", label: "Food", icon: FoodIcon, also: [] },
  { href: "/progress", label: "Profile", icon: ProfileIcon, also: ["/feed", "/settings", "/ranks", "/trends", "/calendar"] },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="App" className="nav-float">
      <ul className="flex">
        {ITEMS.map((it) => {
          const on = [it.href, ...it.also].some((h) => path === h || path.startsWith(h + "/"));
          return (
            <li key={it.href} className="flex-1 relative">
              {on && <motion.span layoutId="nav-pill" className="absolute inset-x-2 top-1.5 h-9 rounded-[14px] shadow-[0_8px_20px_-6px_rgba(40,205,120,.7)]" style={{ background: "var(--grad)" }} transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Link href={it.href} aria-current={on ? "page" : undefined} onClick={() => navigator.vibrate?.(6)} className={`relative grid justify-items-center gap-1 py-2.5 text-[11px] tracking-[.1em] uppercase transition-colors ${on ? "text-ink font-semibold" : "text-smoke"}`}>
                <motion.span animate={{ scale: on ? 1.1 : 1, y: on ? -1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="grid place-items-center" aria-hidden="true"><it.icon className="w-6 h-6" strokeWidth={on ? 2 : 1.7} /></motion.span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
