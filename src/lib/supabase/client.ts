import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase now issues "publishable" keys (sb_publishable_…) in place of the
// legacy anon JWT. Either works here; both are public by design.
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

/** Null until the env vars exist — the app is fully usable offline without it. */
export const supabase: SupabaseClient | null = isConfigured && typeof window !== "undefined" ? createBrowserClient(url!, key!) : null;
