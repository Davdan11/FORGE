/* Food search for the web app: a thin relay to Open Food Facts' search service
   (search.openfoodfacts.org), which sends no CORS headers and so cannot be
   called from a browser. Server-side the app can also name itself with a real
   User-Agent, as OFF asks. GET only, a short query, a capped page, cached.

   Web build only: the file ends in `.web.ts`, an extension next.config.ts adds
   for the web build; the native build (a static export, no server) never sees
   it and calls OFF natively instead (lib/nutrition/off.ts). */

const UPSTREAM = "https://search.openfoodfacts.org/search";
const FIELDS = "code,product_name,product_name_fr,brands,nutriments,serving_size,serving_quantity,image_small_url";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const lang = url.searchParams.get("lang") === "en" ? "en" : "fr";
  if (q.length < 3) return Response.json({ hits: [] });
  const upstream = `${UPSTREAM}?${new URLSearchParams({ q, langs: lang, page_size: "20", fields: FIELDS })}`;
  try {
    const res = await fetch(upstream, { headers: { "User-Agent": "FORGE/0.6 (fitness app; food logging)", Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return Response.json({ hits: [], error: res.status }, { status: 502 });
    const data = (await res.json()) as { hits?: unknown[] };
    return Response.json({ hits: data.hits ?? [] }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch {
    return Response.json({ hits: [], error: "unreachable" }, { status: 502 });
  }
}
