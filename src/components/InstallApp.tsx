"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { isNativeShell } from "@/lib/native";
import { Logo } from "./Logo";

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const HIDE = "forge.installHidden";

/* On the website, an invitation to put FORGE on the home screen like an app (it then opens full screen and works
   offline). Android/desktop Chrome: its own install prompt. iPhone Safari: how to do it (Share → Add to Home Screen).
   Never in the phone apps, never once installed, never again after "Plus tard". */
export function InstallApp() {
  const t = useT();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    let hidden = false; try { hidden = localStorage.getItem(HIDE) === "1"; } catch { /* private mode */ }
    if (standalone || hidden || isNativeShell()) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as Prompt); setShow(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (/iphone|ipad/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)) { setIos(true); setShow(true); }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;
  const later = () => { try { localStorage.setItem(HIDE, "1"); } catch { /* private mode */ } setShow(false); };
  return (
    <div className="card p-4 flex items-center gap-4 bg-[#0e1016] text-bone border-0">
      <span className="grid place-items-center w-12 h-12 rounded-xl bg-[#1a1d25] shrink-0"><Logo mark className="h-7 w-auto" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{t("Installe FORGE sur ton téléphone", "Install FORGE on your phone")}</p>
        <p className="text-xs text-bone/60">{ios ? t("Touche Partager, puis « Sur l’écran d’accueil ». Plein écran, et ça marche hors ligne.", "Tap Share, then “Add to Home Screen”. Full screen, and it works offline.") : t("Une icône sur ton écran d’accueil, plein écran, et ça marche hors ligne.", "An icon on your home screen, full screen, and it works offline.")}</p>
      </div>
      <div className="grid gap-1 shrink-0">
        {prompt && <button type="button" className="pill pill--sm pill--volt" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setShow(false); }}>{t("Installer", "Install")}</button>}
        <button type="button" className="text-xs text-bone/50 underline" onClick={later}>{t("Plus tard", "Later")}</button>
      </div>
    </div>
  );
}
