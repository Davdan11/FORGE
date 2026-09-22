"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile } from "@/lib/db";
import { advanceProgramme } from "@/lib/engine/progression";
import { syncReminders } from "@/lib/remindersSync";
import { listenForReminderTaps } from "@/lib/notify";
import { ScreenSkeleton } from "./ui";

/** Sends the user to onboarding until a profile exists. */
export function Guard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    getProfile().then((p) => {
      if (!p) { router.replace("/onboarding"); return; }
      setOk(true);
      // Review the last block and extend the programme if a new one has begun.
      // Pages read the plan live, so they pick the result up when it lands.
      advanceProgramme().catch((e) => console.error("programme advance failed", e))
        // Reminders follow the plan, so they are rebuilt after it moves.
        .then(() => syncReminders()).catch((e) => console.error("reminders failed", e));
      listenForReminderTaps().catch(() => {});
    });
  }, [router]);
  if (!ok) return <ScreenSkeleton />;
  return <>{children}</>;
}
