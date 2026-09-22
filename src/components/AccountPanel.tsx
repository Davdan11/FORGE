"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { isEmail, normalisePhone, sendCode, signInWith, verifyCode, type Provider } from "@/lib/auth";
import { Press } from "./motion";

export const AUTH_ERROR_EVENT = "forge:autherror";

type Step = { kind: "choose" } | { kind: "email" } | { kind: "phone" } | { kind: "code"; to: { email: string } | { phone: string } };

/* Create an account or sign in — the same thing here: whichever way the
   person picks, an account that does not exist yet is created on the spot.
   `onSignedIn` fires once, however the session arrives (code, web redirect,
   or the native deep link caught by AuthBridge). */
export function AccountPanel({ onSignedIn: onSignedInProp, compact = false }: { onSignedIn: (u: User) => void; compact?: boolean }) {
  // A code sign-in both returns the user and fires SIGNED_IN; report it once.
  const fired = useRef(false);
  const onSignedIn = useCallback((u: User) => { if (fired.current) return; fired.current = true; onSignedInProp(u); }, [onSignedInProp]);
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) onSignedIn(session.user);
    });
    const onErr = (e: Event) => { setBusy(null); setError((e as CustomEvent<string>).detail); };
    window.addEventListener(AUTH_ERROR_EVENT, onErr);
    return () => { data.subscription.unsubscribe(); window.removeEventListener(AUTH_ERROR_EVENT, onErr); };
  }, [onSignedIn]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(null);
    try { await fn(); } catch (e) { setError(friendly(e)); } finally { setBusy(null); }
  }

  const provider = (p: Provider) => run(p, () => signInWith(p));

  if (step.kind === "code") {
    const where = "email" in step.to ? step.to.email : step.to.phone;
    return (
      <div className="grid gap-4">
        <p className="text-sm text-smoke">{"email" in step.to
          ? <>Check your email at <strong className="text-ink">{where}</strong>. Tap the sign-in link in it — or, if it shows a six-digit code, type it here.</>
          : <>We sent a six-digit code to <strong className="text-ink">{where}</strong>.</>}</p>
        <label className="field"><span className="meta">Code</span>
          <input className="input tnum text-center text-2xl tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" />
        </label>
        {error && <p className="text-sm text-[#b42318]" role="alert">{error}</p>}
        <Press><button type="button" className="pill pill--volt pill--block" disabled={code.length !== 6 || !!busy} onClick={() => run("verify", async () => { onSignedIn(await verifyCode(step.to, code)); })}>{busy === "verify" ? "Checking…" : "Continue"}</button></Press>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-smoke underline" onClick={() => { setCode(""); setStep({ kind: "email" in step.to ? "email" : "phone" }); }}>Change {"email" in step.to ? "email" : "number"}</button>
          <button type="button" className="text-smoke underline" disabled={!!busy} onClick={() => run("resend", () => sendCode(step.to))}>{busy === "resend" ? "Sending…" : "Send a new code"}</button>
        </div>
      </div>
    );
  }

  if (step.kind === "email" || step.kind === "phone") {
    const isMail = step.kind === "email";
    const target = isMail ? (isEmail(email) ? { email } : null) : (normalisePhone(phone) ? { phone: normalisePhone(phone)! } : null);
    return (
      <div className="grid gap-4">
        {isMail
          ? <label className="field"><span className="meta">Email</span><input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          : <label className="field"><span className="meta">Mobile number</span><input className="input tnum" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="514 555 1234" /><span className="text-xs text-smoke">Outside North America, start with + and your country code.</span></label>}
        {error && <p className="text-sm text-[#b42318]" role="alert">{error}</p>}
        <Press><button type="button" className="pill pill--volt pill--block" disabled={!target || !!busy} onClick={() => target && run("send", async () => { await sendCode(target); setCode(""); setStep({ kind: "code", to: target }); })}>{busy === "send" ? "Sending…" : "Send me a code"}</button></Press>
        <button type="button" className="text-sm text-smoke underline justify-self-start" onClick={() => { setError(null); setStep({ kind: "choose" }); }}>← Other ways to sign in</button>
      </div>
    );
  }

  return (
    <div className={`grid ${compact ? "gap-2" : "gap-3"}`}>
      <button type="button" className="pill pill--block !bg-ink !text-bone !border-ink gap-3" disabled={!!busy} onClick={() => provider("apple")}><AppleMark />{busy === "apple" ? "Opening Apple…" : "Continue with Apple"}</button>
      <button type="button" className="pill pill--block !bg-white gap-3" disabled={!!busy} onClick={() => provider("google")}><GoogleMark />{busy === "google" ? "Opening Google…" : "Continue with Google"}</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="pill" onClick={() => { setError(null); setStep({ kind: "phone" }); }}>Phone number</button>
        <button type="button" className="pill" onClick={() => { setError(null); setStep({ kind: "email" }); }}>Email</button>
      </div>
      {error && <p className="text-sm text-[#b42318]" role="alert">{error}</p>}
    </div>
  );
}

/* Supabase's messages are written for developers; these are for people. */
function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/expired|invalid.*(otp|token)|token.*(expired|invalid)/i.test(m)) return "That code is wrong or has expired. Ask for a new one.";
  if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a minute, then ask for a new code.";
  if (/provider is not enabled|unsupported provider/i.test(m)) return "That sign-in method isn’t switched on yet.";
  if (/phone.*(provider|sms)|sms.*(provider|not)/i.test(m)) return "Text messages aren’t set up yet. Use email for now.";
  if (/failed to fetch|network/i.test(m)) return "No connection. Check your network and try again.";
  return m;
}

/* Brand marks as their sign-in guidelines ask them to be shown. */
function AppleMark() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><path d="M16.37 12.62c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.43-3.65-.02-.04 0-.02 0-.04ZM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.51 2.68-1.27Z" /></svg>;
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.57 10.57 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
