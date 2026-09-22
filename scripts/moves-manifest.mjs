// Scan public/moves for <slug>.webm / .mp4 / .jpg|.png|.webp and write manifest.json.
// Usage: npm run moves
import { readdirSync, writeFileSync } from "node:fs";
import { join, extname, basename } from "node:path";

const dir = join(process.cwd(), "public", "moves");
const out = {};
for (const f of readdirSync(dir)) {
  const ext = extname(f).toLowerCase(), slug = basename(f, ext);
  if (f === "manifest.json") continue;
  out[slug] ??= {};
  if (ext === ".webm") out[slug].webm = `/moves/${f}`;
  else if (ext === ".mp4") out[slug].mp4 = `/moves/${f}`;
  else if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) out[slug].poster = `/moves/${f}`;
}
for (const k of Object.keys(out)) if (!out[k].webm && !out[k].mp4) delete out[k];
writeFileSync(join(dir, "manifest.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`moves: ${Object.keys(out).length} exercise loops indexed`);
