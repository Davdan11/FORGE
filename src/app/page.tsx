"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { getProfile } from "@/lib/db";

/** Entry: route to onboarding until a profile exists, then to Today. */
export default function Root() {
  const router = useRouter();
  useEffect(() => {
    getProfile().then((p) => router.replace(p ? "/today" : "/onboarding"));
  }, [router]);
  return (
    <main className="flex-1 grid place-items-center">
      <div className="grid justify-items-center gap-3">
        <span className="display text-6xl text-ink overflow-hidden flex">
          {"FORGE".split("").map((c, i) => (
            <motion.i key={i} className="not-italic inline-block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}>{c}</motion.i>
          ))}
        </span>
        <motion.span className="h-[2px] bg-volt" initial={{ width: 0 }} animate={{ width: 96 }} transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    </main>
  );
}
