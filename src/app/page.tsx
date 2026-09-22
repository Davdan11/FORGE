"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { getProfile } from "@/lib/db";
import { documentUrl } from "@/lib/native";

/* ─────────────────────────────────────────────────────────────
   Boot.

   Read whether a profile exists, then go to Today or to
   onboarding. Three rules, all of them learned the hard way while
   getting this running inside the native shell:

   1. It cannot hang. The read is raced against a deadline,
      because a promise that never settles shows a logo forever
      and says nothing — which is exactly what the iOS build did.
   2. It navigates hard, not through the router. A soft navigation
      fetches an RSC payload; in a static export on a capacitor://
      URL that fetch can fail, and the navigation is then dropped
      in silence.
   3. When it does fail it SAYS so, on screen, with the reason. A
      splash that never ends is the worst thing an app can do,
      because it is indistinguishable from a crash.
   ───────────────────────────────────────────────────────────── */

/** Long enough for a cold IndexedDB open on a slow device, short enough that
 *  nobody sits staring at a logo wondering whether it is broken. */
const DEADLINE_MS = 4000;

type Boot =
  | { state: "reading" }
  | { state: "failed"; why: string };

export default function Root() {
  const [boot, setBoot] = useState<Boot>({ state: "reading" });

  useEffect(() => {
    let done = false;

    const go = (to: string) => {
      if (done) return;
      done = true;
      // documentUrl names the file: Capacitor serves files, not directories.
      window.location.replace(documentUrl(to));
    };

    const fail = (why: string) => {
      if (done) return;
      done = true;
      setBoot({ state: "failed", why });
    };

    const timer = window.setTimeout(
      () => fail("Storage did not respond. Your data is on this device; the app just could not open it."),
      DEADLINE_MS,
    );

    getProfile()
      .then((p) => { window.clearTimeout(timer); go(p ? "/today/" : "/onboarding/"); })
      .catch((e: unknown) => {
        window.clearTimeout(timer);
        fail(e instanceof Error ? e.message : String(e));
      });

    return () => { window.clearTimeout(timer); done = true; };
  }, []);

  return (
    <main className="flex-1 grid place-items-center px-6">
      <div className="grid justify-items-center gap-3 text-center">
        <span className="display display--lg text-ink overflow-hidden flex" style={{ fontSize: "var(--text-display-lg)" }}>
          {"FORGE".split("").map((c, i) => (
            <motion.i key={i} className="not-italic inline-block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}>{c}</motion.i>
          ))}
        </span>
        <motion.span className="h-[2px] bg-volt" initial={{ width: 0 }} animate={{ width: 96 }} transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />

        {boot.state === "failed" && (
          <div className="grid gap-3 mt-8 max-w-[38ch]">
            <p className="text-sm text-danger">{boot.why}</p>
            <div className="flex gap-2 justify-center">
              <button type="button" className="pill pill--sm" onClick={() => window.location.reload()}>Try again</button>
              <button type="button" className="pill pill--sm pill--volt" onClick={() => window.location.replace(documentUrl("/onboarding/"))}>Start anyway</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
