import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import { isNativeShell } from "./native";
import { forgetSyncCursor, syncNow } from "./sync";
import { getProfile } from "./db";

/* ─────────────────────────────────────────────────────────────
   Accounts: Google, Apple, phone number or email.

   Phone and email use a six-digit code typed into the app, not a
   link. A link has to find its way back into the right app on the
   right device; a code only has to be read.

   Google and Apple use OAuth, and in the native shell OAuth must
   NOT run inside the app's WebView: Google refuses embedded
   WebViews outright ("disallowed_useragent"), and a sign-in page
   the app itself hosts is exactly what users are told not to
   trust. So the sign-in opens in the system browser, the provider
   redirects to `ca.danjou.forge://auth/callback`, Android or iOS
   hands that URL back to the app, and the app exchanges the code
   for a session (PKCE, so the code is useless to anyone else).

   On the web the provider redirects to /auth/callback instead.
   ───────────────────────────────────────────────────────────── */

export type Provider = "google" | "apple";

/** Must match the scheme in AndroidManifest.xml and Info.plist, and be listed
 *  under Authentication → URL Configuration → Redirect URLs in Supabase. */
export const NATIVE_CALLBACK = "ca.danjou.forge://auth/callback";

const need = () => {
  if (!supabase) throw new Error("Accounts are not set up yet (Supabase is not configured).");
  return supabase;
};

export async function currentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** A readable name for the signed-in account: email, phone or provider name. */
export function accountLabel(u: User) {
  return u.email || (u.phone ? `+${u.phone.replace(/^\+/, "")}` : "") || (u.user_metadata?.full_name as string | undefined) || "your account";
}

/** First name from the provider, to pre-fill onboarding. */
export const firstName = (u: User | null) => ((u?.user_metadata?.full_name ?? u?.user_metadata?.name ?? "") as string).split(" ")[0] ?? "";

export async function signInWith(provider: Provider) {
  const sb = need();
  const native = isNativeShell();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: native ? NATIVE_CALLBACK : `${window.location.origin}/auth/callback/`,
      // In the shell we open the URL ourselves, in the system browser.
      skipBrowserRedirect: native,
      // Apple only sends the name on the very first sign-in, and only if asked.
      scopes: provider === "apple" ? "name email" : undefined,
    },
  });
  if (error) throw error;
  if (native && data.url) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url, presentationStyle: "popover" });
  }
}

/** Finish an OAuth sign-in from the callback URL (web page or deep link). */
export async function completeFromUrl(url: string): Promise<User | null> {
  const sb = need();
  const u = new URL(url);
  const err = u.searchParams.get("error_description") ?? new URLSearchParams(u.hash.slice(1)).get("error_description");
  if (err) throw new Error(err);
  const code = u.searchParams.get("code");
  if (!code) return null;
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data.user;
}

let listening = false;
/**
 * In the native shell, catch the provider's redirect back into the app.
 * Call once at startup. `onSignedIn` runs after the session is stored.
 */
export async function listenForAuthRedirects(onSignedIn: (u: User) => void, onError: (m: string) => void) {
  if (listening || !isNativeShell() || !supabase) return;
  listening = true;
  const [{ App }, { Browser }] = await Promise.all([import("@capacitor/app"), import("@capacitor/browser")]);
  await App.addListener("appUrlOpen", async ({ url }) => {
    if (!url.startsWith(NATIVE_CALLBACK)) return;
    await Browser.close().catch(() => {}); // Android has nothing to close; that is fine
    try {
      const user = await completeFromUrl(url);
      if (user) onSignedIn(user);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Sign-in failed.");
    }
  });
}

/* ── Codes: email and phone ────────────────────────────────── */

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/**
 * A phone number in E.164 (+15145551234). A ten-digit number with no country
 * code is read as North American, which is who this app ships to first.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return /^\+\d{8,15}$/.test(digits) ? digits : null;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

/** Send a six-digit code. Creates the account if there is none yet. */
export async function sendCode(to: { email: string } | { phone: string }) {
  const sb = need();
  // Supabase's default email carries a sign-in link, and its template can only
  // be changed once a custom SMTP sender is set up. So the email works both
  // ways: the link comes back here (web callback page, or the app's deep link
  // on a phone) and a code, when the template includes one, is typed in.
  const back = isNativeShell() ? NATIVE_CALLBACK : `${window.location.origin}/auth/callback/`;
  const { error } = "email" in to
    ? await sb.auth.signInWithOtp({ email: to.email.trim(), options: { shouldCreateUser: true, emailRedirectTo: back } })
    : await sb.auth.signInWithOtp({ phone: to.phone, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(to: { email: string } | { phone: string }, code: string): Promise<User> {
  const sb = need();
  const token = code.replace(/\D/g, "");
  const { data, error } = "email" in to
    ? await sb.auth.verifyOtp({ email: to.email.trim(), token, type: "email" })
    : await sb.auth.verifyOtp({ phone: to.phone, token, type: "sms" });
  if (error) throw error;
  if (!data.user) throw new Error("That code did not sign you in. Ask for a new one.");
  return data.user;
}

/**
 * Right after signing in: bring the account's data onto this device (a new
 * phone, a reinstall) and push anything made here before signing in. Returns
 * whether a profile now exists, i.e. whether onboarding can be skipped.
 */
export async function restoreAccount(): Promise<{ hasProfile: boolean; message: string }> {
  forgetSyncCursor(); // a first sync on this device pulls the whole account
  const message = await syncNow();
  return { hasProfile: !!(await getProfile()), message };
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

/**
 * Delete the account and everything stored with it on the server, then sign
 * out. Returns an error message, or null when it is gone. The caller wipes
 * this device afterwards; what is here is not the server's to delete.
 */
export async function deleteAccount(): Promise<string | null> {
  if (!supabase) return "Accounts aren't set up in this build.";
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    // The function is created by supabase/delete-account.sql. Until it has
    // been run, say so plainly rather than pretending the account is gone.
    return /function|schema cache/i.test(error.message)
      ? "Account deletion isn't available yet. Contact support and we'll delete it for you."
      : `Couldn't delete the account: ${error.message}`;
  }
  await supabase.auth.signOut().catch(() => {});
  return null;
}
