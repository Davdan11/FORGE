// Resize and re-encode badge / rank artwork for the web, then re-index it.
// Usage: npm run art:optimise
//
// Source art is generated at a print-like resolution; the app never draws a
// shield larger than ~190 px. Shipping the originals costs megabytes on a
// device for pixels nobody sees — and this is an app people install and use
// offline.
//
// Originals are moved to `art-source/` at the project root — deliberately
// OUTSIDE `public/`, because anything left in there is still served and still
// shipped, which would defeat the whole point.
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import sharp from "sharp";

/** Twice the largest size the app renders, which covers 2× and 3× screens. */
const MAX = 512;
const QUALITY = 90;
const SOURCE_ROOT = "art-source";
const INPUT = [".png", ".jpg", ".jpeg"];

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function optimise(folder) {
  const dir = join(process.cwd(), "public", folder);
  if (!existsSync(dir)) return { done: 0, before: 0, after: 0 };
  const keep = join(process.cwd(), SOURCE_ROOT, folder);

  let done = 0, before = 0, after = 0;
  for (const f of readdirSync(dir)) {
    const ext = extname(f).toLowerCase();
    if (!INPUT.includes(ext)) continue;

    const from = join(dir, f);
    const name = basename(f, ext);
    const to = join(dir, `${name}.webp`);
    const sizeBefore = statSync(from).size;

    const meta = await sharp(from).metadata();
    await sharp(from)
      // `inside` keeps the aspect ratio and never enlarges art that is already
      // small enough; the alpha channel is preserved.
      .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY, alphaQuality: 100, effort: 6 })
      .toFile(to);

    const sizeAfter = statSync(to).size;
    if (!existsSync(keep)) mkdirSync(keep, { recursive: true });
    renameSync(from, join(keep, f));

    console.log(`  ${f}  ${meta.width}px ${kb(sizeBefore)}  →  ${name}.webp  ${Math.min(MAX, meta.width)}px ${kb(sizeAfter)}`);
    done += 1; before += sizeBefore; after += sizeAfter;
  }
  return { done, before, after };
}

let before = 0, after = 0, done = 0;
for (const folder of ["ranks", "badges"]) {
  const r = await optimise(folder);
  if (r.done) console.log(`${folder}: ${r.done} file${r.done === 1 ? "" : "s"}`);
  done += r.done; before += r.before; after += r.after;
}

if (!done) console.log("art: nothing to optimise — everything is already WebP.");
else {
  const saved = before - after;
  console.log(`\nart: ${done} files · ${kb(before)} → ${kb(after)} (${Math.round((saved / before) * 100)}% smaller)`);
  console.log(`originals kept out of the build in ${SOURCE_ROOT}/`);
}
