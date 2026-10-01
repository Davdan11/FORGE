"use client";

import { useCallback, useEffect, useState } from "react";
import { GoogleWebButton } from "@/components/GoogleSignIn";
import { isEmail } from "@/lib/auth";
import { handOver, parsePending, pcClient, readPending, savePending, type PcPending } from "@/lib/pcLink";
import { tr, useT } from "@/lib/i18n";

/* The Windows game's sign-in (lib/pcLink): opened by FORGE Ride with ?port=…&state=…, signs in with Google or an
   email code/link, and hands that new session to the game on this computer. Never touches the web app's own session. */
export default function PcLogin() {
  const t = useT();
  const [pending, setPending] = useState<PcPending | null>(null);
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState<"choose" | "email" | "code" | "done">("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = parsePending(window.location.search) ?? readPending();
    if (p) savePending(p);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only known after mount (static export)
    setPending(p); setChecked(true);
  }, []);

  const finish = useCallback(async () => {
    const sb = pcClient(), p = pending;
    if (!sb || !p) return;
    const { data } = await sb.auth.getSession();
    if (!data.session) { setError(tr("La connexion n’a pas abouti. Réessaie.", "Sign-in did not complete. Try again.")); return; }
    setStep("done");
    handOver(data.session, p);
  }, [pending]);
  const onGoogle = useCallback(() => { void finish(); }, [finish]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  const sb = pcClient();
  if (!checked) return null;
  if (!pending || !sb) {
    return (
      <Shell title={<>{t("Ouvre cette page", "Open this page")} <em>{t("depuis le jeu.", "from the game.")}</em></>}>
        <p className="text-sm text-smoke">{t("Dans FORGE Ride sur ton ordinateur, clique « CONNEXION » sur l’écran d’accueil : le jeu ouvre cette page pour toi.", "In FORGE Ride on your computer, click “SIGN IN” on the home screen: the game opens this page for you.")}</p>
      </Shell>
    );
  }
  if (step === "done") {
    return (
      <Shell title={<>{t("C’est fait.", "Done.")} <em>{t("Retourne dans le jeu.", "Back to the game.")}</em></>}>
        <p className="text-sm text-smoke">{t("FORGE Ride est connecté à ton compte. Tu peux fermer cet onglet.", "FORGE Ride is signed in to your account. You can close this tab.")}</p>
      </Shell>
    );
  }

  return (
    <Shell title={<>{t("Connecte", "Sign in")} <em>{t("FORGE Ride.", "FORGE Ride.")}</em></>}>
      <p className="text-sm text-smoke">{t("Pour rouler en ligne avec les autres dans le jeu sur ton ordinateur. Le même compte que dans l’app.", "To ride online with others in the game on your computer. The same account as in the app.")}</p>
      {step === "choose" && (
        <div className="grid gap-3">
          <GoogleWebButton client={sb} onSignedIn={onGoogle} onError={setError} fallback={null} />
          <button type="button" className="pill pill--block" onClick={() => { setError(null); setStep("email"); }}>{t("Avec mon courriel", "With my email")}</button>
        </div>
      )}
      {step === "email" && (
        <div className="grid gap-3">
          <label className="field"><span className="meta">{t("Courriel", "Email")}</span><input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("toi@exemple.com", "you@example.com")} /></label>
          <button type="button" className="pill pill--volt pill--block" disabled={!isEmail(email) || busy} onClick={() => run(async () => {
            // The link comes back to /auth/callback/, which sees the game's sign-in waiting and finishes it (lib/pcLink).
            const { error: e } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback/` } });
            if (e) throw e;
            setCode(""); setStep("code");
          })}>{busy ? t("Envoi…", "Sending…") : t("Envoie-moi un lien", "Send me a link")}</button>
          <button type="button" className="text-sm text-smoke underline justify-self-start" onClick={() => setStep("choose")}>← {t("Retour", "Back")}</button>
        </div>
      )}
      {step === "code" && (
        <div className="grid gap-3">
          <p className="text-sm text-smoke">{t("Ouvre le courriel envoyé à", "Open the email sent to")} <strong className="text-ink">{email}</strong> {t("sur cet ordinateur et clique le lien. S’il affiche un code à six chiffres, tape-le ici.", "on this computer and click the link. If it shows a six-digit code, type it here.")}</p>
          <label className="field"><span className="meta">{t("Code", "Code")}</span>
            <input className="input tnum text-center text-2xl tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" />
          </label>
          <button type="button" className="pill pill--volt pill--block" disabled={code.length !== 6 || busy} onClick={() => run(async () => {
            const { error: e } = await sb.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
            if (e) throw e;
            await finish();
          })}>{busy ? t("Vérification…", "Checking…") : t("Continuer", "Continue")}</button>
        </div>
      )}
      {error && <p className="text-sm text-[#b42318]" role="alert">{error}</p>}
    </Shell>
  );
}

function Shell({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh grid place-items-center p-8">
      <div className="grid gap-5 w-full max-w-[380px]">
        <p className="display text-3xl">{title}</p>
        {children}
      </div>
    </main>
  );
}
