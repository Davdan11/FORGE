"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n";

/* "Continue with Google" on the web, with Google's own button (Google Identity
   Services). The redirect sign-in goes through Supabase's domain, so Google's
   screen says "continue to uqfuhw….supabase.co" — confusing for anyone. Here
   Google hands the signed ID token straight to this page (its origin is
   app.forgeachieve.com, which is what Google shows), and Supabase checks it
   (signInWithIdToken). A nonce ties the token to this one attempt.

   The phone apps keep the system-browser redirect (see lib/auth.ts): a WebView
   cannot host Google's button. The client ID is public by design. */

export const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "852207711476-61ulbv75hkc0g0c7ugjdq07te947v8sl.apps.googleusercontent.com";

type Gsi = {
  accounts: { id: {
    initialize: (o: Record<string, unknown>) => void;
    renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  } };
};

let scriptPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if ((window as unknown as { google?: Gsi }).google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
    s.onload = () => resolve(); s.onerror = () => { scriptPromise = null; reject(new Error("gsi")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function GoogleWebButton({ onSignedIn, onError, fallback }: { onSignedIn: (u: User) => void; onError: (message: string) => void; fallback: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) throw new Error("no supabase");
      const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const hashed = await sha256Hex(raw);
      await loadGsi();
      const google = (window as unknown as { google?: Gsi }).google;
      if (!live || !google || !box.current) return;
      google.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        nonce: hashed,
        ux_mode: "popup",
        use_fedcm_for_button: true,
        callback: async (resp: { credential?: string }) => {
          if (!resp.credential || !supabase) return;
          const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: resp.credential, nonce: raw });
          if (error) onError(error.message);
          else if (data.user) onSignedIn(data.user);
        },
      });
      box.current.innerHTML = "";
      google.accounts.id.renderButton(box.current, {
        type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", logo_alignment: "center",
        width: Math.min(400, Math.max(240, box.current.offsetWidth || 320)), locale: lang === "fr" ? "fr_CA" : "en",
      });
    })().catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [lang, onError, onSignedIn]);

  if (failed) return <>{fallback}</>;
  return <div ref={box} className="flex justify-center min-h-[44px] w-full" />;
}
