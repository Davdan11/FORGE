/* ─────────────────────────────────────────────────────────────
   Exercise media — rendered 3D loops (anatomical mannequin, working
   muscle lit red) served from /public/moves/<slug>.{webm,mp4,jpg}.
   `manifest.json` is written by `npm run moves` after dropping files
   in. Anything missing falls back to the exercise photograph.
   ───────────────────────────────────────────────────────────── */
import manifest from "../../../public/moves/manifest.json";

export type MoveMedia = { webm?: string; mp4?: string; poster?: string };

const MEDIA = manifest as Record<string, MoveMedia>;

export function moveMedia(slug: string): MoveMedia | undefined {
  const m = MEDIA[slug];
  return m && (m.webm || m.mp4) ? m : undefined;
}

export const mediaCount = () => Object.keys(MEDIA).length;
