"use client";

import { useEffect, useState } from "react";
import { completeFromUrl, restoreAccount } from "@/lib/auth";
import { documentUrl } from "@/lib/native";
import { handOver, isPcLinkReturn, pcClient, readPending } from "@/lib/pcLink";
import { tr, useT } from "@/lib/i18n";

/* Where Google and Apple send a web sign-in back to. Stores the session,
   brings the account's data onto this device, then goes on to the app — or to
   onboarding if this account has never set up a profile. */
export default function AuthCallback() {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        // The email link of the Windows game's sign-in (/pc-login/): its own session, handed to the game.
        const code = new URL(window.location.href).searchParams.get("code"), pc = pcClient(), pending = readPending();
        if (code && pc && pending && isPcLinkReturn()) {
          const { data, error: e } = await pc.auth.exchangeCodeForSession(code);
          if (e || !data.session) throw e ?? new Error(tr("La connexion a échoué.", "Sign-in failed."));
          setGame(true); handOver(data.session, pending);
          return;
        }
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
        {game && !error && <p className="text-sm text-smoke">{t("FORGE Ride est connecté à ton compte. Retourne dans le jeu ; tu peux fermer cet onglet.", "FORGE Ride is signed in to your account. Go back to the game; you can close this tab.")}</p>}
        <p className="display text-3xl">{error ? <>{t("Connexion", "Sign-in")} <em>{t("échouée.", "failed.")}</em></> : <>{t("Connexion", "Signing you")} <em>{t("en cours…", "in…")}</em></>}</p>
        {error && <><p className="text-sm text-smoke">{error}</p><a className="pill pill--volt" href={documentUrl("/onboarding/")}>{t("Réessayer", "Try again")}</a></>}
      </div>
    </main>
  );
}
