import { OFF_FIELDS, parseOffProduct, type FoodItem } from "./foodlog";
import { isNativeShell } from "../native";

/* ─────────────────────────────────────────────────────────────
   Open Food Facts, read-only.

   Their rules (openfoodfacts.github.io/openfoodfacts-server/api):
   GET only, name the app, ask only for the fields used, and stay
   under the rate limits (product reads ~100/min, searches ~10/min).
   A browser may not set its own User-Agent, so the app names itself
   with the `app_name` parameter instead, and searches go through a
   small limiter plus a cache so typing never floods them.

   Text search uses OFF's search service (search.openfoodfacts.org):
   fast and relevant, but it sends no CORS headers, so a page cannot
   call it. The phone app calls it natively (CapacitorHttp, no CORS),
   the web app through its own relay (/api/food-search). The classic
   /cgi/search.pl stays as a last resort; it is often throttled.
   ───────────────────────────────────────────────────────────── */

const WORLD = "https://world.openfoodfacts.org";

export function appName(): string {
  if (typeof navigator === "undefined") return "FORGE - Web";
  if (!isNativeShell()) return "FORGE - Web";
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "FORGE - iOS" : "FORGE - Android";
}

/* A sliding window: at most `max` calls in `windowMs`. */
function limiter(max: number, windowMs: number) {
  const hits: number[] = [];
  return () => {
    const now = Date.now();
    while (hits.length && now - hits[0] > windowMs) hits.shift();
    if (hits.length >= max) return false;
    hits.push(now);
    return true;
  };
}
const searchSlot = limiter(10, 60_000);
const productSlot = limiter(60, 60_000);

export class RateLimited extends Error { constructor() { super("rate-limited"); } }

async function getJson(url: string, timeoutMs = 9000): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: ctl.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`OFF ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

const qs = (o: Record<string, string | number>) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");

const productCache = new Map<string, FoodItem | null>();
/** One product by its barcode; null when Open Food Facts does not know it or lacks its calories. */
export async function lookupBarcode(code: string, lang: "fr" | "en" = "fr"): Promise<FoodItem | null> {
  if (productCache.has(code)) return productCache.get(code) ?? null;
  if (!productSlot()) throw new RateLimited();
  const data = (await getJson(`${WORLD}/api/v2/product/${encodeURIComponent(code)}.json?${qs({ fields: OFF_FIELDS.join(","), lc: lang, app_name: appName() })}`)) as { status?: number; product?: Record<string, unknown> } | null;
  const item = data && data.product ? parseOffProduct({ code, ...data.product }, lang) : null;
  const withCode = item ? { ...item, barcode: code, offCode: code, key: `off:${code}` } : null;
  productCache.set(code, withCode);
  return withCode;
}

const searchCache = new Map<string, FoodItem[]>();
/** Packaged foods by name, Canadian products first. Throws RateLimited when searching too fast. */
export async function searchOff(query: string, lang: "fr" | "en" = "fr"): Promise<FoodItem[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = `${lang}:${q.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit) return hit;
  if (!searchSlot()) throw new RateLimited();
  // 1. The search service: natively on the phone, through the relay on the web.
  try {
    const hits = await searchService(q, lang);
    if (hits.length) {
      const out = parseAll(hits, lang);
      searchCache.set(key, out);
      return out;
    }
  } catch { /* fall through to the classic search */ }
  const base = { search_terms: q, search_simple: 1, action: "process", json: 1, page_size: 20, lc: lang, fields: OFF_FIELDS.join(","), app_name: appName() };
  const data = (await getJson(`${WORLD}/cgi/search.pl?${qs({ ...base, tagtype_0: "countries", tag_contains_0: "contains", tag_0: "canada" })}`)) as { products?: unknown[] } | null;
  let raw = data?.products ?? [];
  // Nothing sold in Canada under that name: the whole world, if the limit allows.
  if (!raw.length && searchSlot()) raw = ((await getJson(`${WORLD}/cgi/search.pl?${qs(base)}`)) as { products?: unknown[] } | null)?.products ?? [];
  const out = parseAll(raw, lang);
  searchCache.set(key, out);
  return out;
}

function parseAll(raw: unknown[], lang: "fr" | "en"): FoodItem[] {
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  for (const p of raw) {
    const item = parseOffProduct(p as Parameters<typeof parseOffProduct>[0], lang);
    if (!item || seen.has(item.key)) continue;
    seen.add(item.key); out.push(item);
  }
  return out;
}

async function searchService(q: string, lang: "fr" | "en"): Promise<unknown[]> {
  if (isNativeShell()) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const params = { q, langs: lang, page_size: "20", fields: OFF_FIELDS.join(",") };
    const res = await CapacitorHttp.get({ url: "https://search.openfoodfacts.org/search", params, headers: { Accept: "application/json" }, connectTimeout: 8000, readTimeout: 8000 });
    if (res.status !== 200) throw new Error(`OFF ${res.status}`);
    const data = (typeof res.data === "string" ? JSON.parse(res.data) : res.data) as { hits?: unknown[] };
    return data.hits ?? [];
  }
  const data = (await getJson(`/api/food-search?${qs({ q, lang })}`)) as { hits?: unknown[] } | null;
  return data?.hits ?? [];
}
