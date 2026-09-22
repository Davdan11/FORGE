"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile } from "@/lib/db";
import { ScreenSkeleton } from "./ui";

/** Sends the user to onboarding until a profile exists. */
export function Guard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    getProfile().then((p) => { if (!p) router.replace("/onboarding"); else setOk(true); });
  }, [router]);
  if (!ok) return <ScreenSkeleton />;
  return <>{children}</>;
}
