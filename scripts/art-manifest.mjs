// Scan public/badges and public/ranks for artwork and write their manifests.
// Drop <badge-id>.png (and optionally <badge-id>--locked.png) into public/badges,
// or <tier-key>.png into public/ranks, then run: npm run art
//
// Anything without a file keeps the drawn SVG emblem, so the two can be mixed
// while the set is being filled in.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, extname, basename } from "node:path";

const OK = [".png", ".webp", ".jpg", ".jpeg", ".svg", ".avif"];

function index(folder) {
  const dir = join(process.cwd(), "public", folder);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = {};
  for (const f of readdirSync(dir)) {
    const ext = extname(f).toLowerCase();
    if (f === "manifest.json" || !OK.includes(ext)) continue;
    let name = basename(f, ext);

    const locked = name.endsWith("--locked");
    if (locked) name = name.slice(0, -"--locked".length);

    // `gold-2.png` is Gold sub-rank II. Without a suffix the file covers the
    // whole tier, which is how a set half-produced still looks finished.
    const sub = name.match(/-([1-5])$/);
    const key = sub ? name.slice(0, -sub[0].length) : name;
    const slot = sub ? `sub${sub[1]}` : "src";

    out[key] ??= {};
    out[key][locked ? `${slot}Locked` : slot] = `/${folder}/${f}`;
  }
  // Fall back to sub-rank I when a tier has no unsuffixed file, so one artwork
  // per tier is enough to ship.
  for (const k of Object.keys(out)) {
    out[k].src ??= out[k].sub1;
    out[k].locked ??= out[k].sub1Locked;
    if (!out[k].src) delete out[k];
  }
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(out, null, 2) + "\n");
  return Object.keys(out).length;
}

const badges = index("badges");
const ranks = index("ranks");
console.log(`art: ${badges} badge${badges === 1 ? "" : "s"}, ${ranks} rank${ranks === 1 ? "" : "s"} indexed`);
