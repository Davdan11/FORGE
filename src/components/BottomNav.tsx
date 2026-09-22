"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Activity, Dumbbell, MapPin, UtensilsCrossed, User, Users, type LucideIcon } from "lucide-react";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/today", label: "Today", icon: Activity },
  { href: "/library", label: "Library", icon: Dumbbell },
  { href: "/move", label: "Move", icon: MapPin },
  { href: "/food", label: "Food", icon: UtensilsCrossed },
  { href: "/feed", label: "Feed", icon: Users },
  { href: "/progress", label: "Profile", icon: User },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="App" className="nav-float">
      <ul className="flex">
        {ITEMS.map((it) => {
          const on = path === it.href || path.startsWith(it.href + "/") || (it.href === "/today" && (path.startsWith("/session") || path.startsWith("/plan"))) || (it.href === "/progress" && path.startsWith("/settings"));
          return (
            <li key={it.href} className="flex-1 relative">
              {on && <motion.span layoutId="nav-pill" className="absolute inset-1.5 rounded-[20px] bg-[rgba(236,231,223,.07)] border border-[rgba(236,231,223,.1)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Link href={it.href} aria-current={on ? "page" : undefined} onClick={() => navigator.vibrate?.(6)} className={`relative grid justify-items-center gap-1 py-2.5 text-[10px] tracking-[.12em] uppercase transition-colors ${on ? "text-volt" : "text-smoke"}`}>
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
