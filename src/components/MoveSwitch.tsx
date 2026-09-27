"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

/* The "Bouge" tab holds two places: outdoor sessions (GPS) and the exercise library. A small glass switch at the
   top of both lets you hop between them, so the bottom bar can stay at five tabs. */
export function MoveSwitch({ className = "" }: { className?: string }) {
  const path = usePathname();
  const t = useT();
  const items = [
    { href: "/move", label: t("Sorties", "Outings") },
    { href: "/library", label: t("Exercices", "Exercises") },
  ];
  return (
    <nav aria-label={t("Bouge", "Move")} className={`inline-flex p-1 rounded-full bg-[rgba(10,14,12,.55)] backdrop-blur-md border border-white/15 shadow-lg ${className}`}>
      {items.map((it) => {
        const on = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} onClick={() => navigator.vibrate?.(6)}
            className={`px-4 py-1.5 rounded-full text-[12px] tracking-[.06em] uppercase transition-colors ${on ? "bg-volt text-ink font-semibold" : "text-white/85 hover:text-white"}`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
