"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile } from "@/lib/db";
import { advanceProgramme } from "@/lib/engine/progression";
import { applyComeback } from "@/lib/engine/comeback";
import { syncReminders } from "@/lib/remindersSync";
import { listenForReminderTaps } from "@/lib/notify";
import { ScreenSkeleton } from "./ui";
import { syncHealth } from "@/lib/health";

/* Remembered once a profile exists: the next opens show the page at once instead of a skeleton while the local
   database opens (the check still runs, and sends to onboarding if the profile is gone). */
const KNOWN = "forge.hasProfile";
const known = () => { try { return localStorage.getItem(KNOWN) === "1"; } catch { return false; } };

/** Sends the user to onboarding until a profile exists. */
export function Guard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (known()) setOk(true);
    getProfile().then((p) => {
      if (!p) { try { localStorage.removeItem(KNOWN); } catch { /* private mode */ } setOk(false); router.replace("/onboarding"); return; }
      try { localStorage.setItem(KNOWN, "1"); } catch { /* private mode */ }
      setOk(true);
      // Review the last block and extend the programme if a new one has begun.
      // Pages read the plan live, so they pick the result up when it lands.
      // Then, after a break of two weeks or more, ease the coming week.
      advanceProgramme().then(() => applyComeback()).catch((e) => console.error("programme advance failed", e))
        // Reminders follow the plan, so they are rebuilt after it moves.
        .then(() => syncReminders()).catch((e) => console.error("reminders failed", e))
        // Health Connect / Apple Health, when connected: the day's steps and sleep, and new watch workouts.
        .then(() => syncHealth()).catch(() => {});
      listenForReminderTaps().catch(() => {});
    });
  }, [router]);
  if (!ok) return <ScreenSkeleton />;
  return <>{children}</>;
}
