"use client";

import { useEffect, useState } from "react";
import { completeFromUrl, restoreAccount } from "@/lib/auth";
import { documentUrl } from "@/lib/native";
import { tr, useT } from "@/lib/i18n";

/* Where Google and Apple send a web sign-in back to. Stores the session,
   brings the account's data onto this device, then goes on to the app — or to
   onboarding if this account has never set up a profile. */
export default function AuthCallback() {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        await completeFromUrl(window.location.href);
        const { hasProfile } = await restoreAccount();
        window.location.replace(documentUrl(hasProfile ? "/today/" : "/onboarding/"));
      } catch (e) {
        setError(e instanceof Error ? e.message : tr("La connexion a échoué.", "Sign-in failed."));
      }
    })();
  }, []);
  return (
    <main className="min-h-dvh grid place-items-center p-8">
      <div className="grid gap-4 max-w-[360px] text-center">
        <p className="display text-3xl">{error ? <>{t("Connexion", "Sign-in")} <em>{t("échouée.", "failed.")}</em></> : <>{t("Connexion", "Signing you")} <em>{t("en cours…", "in…")}</em></>}</p>
        {error && <><p className="text-sm text-smoke">{error}</p><a className="pill pill--volt" href={documentUrl("/onboarding/")}>{t("Réessayer", "Try again")}</a></>}
      </div>
    </main>
  );
}
