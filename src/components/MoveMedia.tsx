"use client";

import { useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { moveMedia } from "@/lib/data/media";
import { exerciseImage } from "@/lib/data/images";
import { Photo } from "./ui";
import type { Exercise, Muscle } from "@/lib/types";

/* Soft edges on all four sides (masks multiply, so the corners fade most). */
const FADE = "linear-gradient(to right, transparent 0%, #000 9%, #000 91%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 7%, #000 95%, transparent 100%)";
const EDGE_FADE: React.CSSProperties = { maskImage: FADE, WebkitMaskImage: FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" };

type Ex = Pick<Exercise, "slug" | "pattern" | "equipment" | "unilateral" | "timed" | "name"> & { primary?: Muscle[]; pillar?: Exercise["pillar"] };

/* Rendered 3D loop when one exists for the exercise; otherwise the
   exercise's editorial photograph with a slow drift. Video is muted,
   inline, plays only on screen and pauses under reduced motion.
   An animated-image loop cannot be paused, so `still` shows its first
   frame instead: lists stay calm and the movement plays once opened.
   `thumb` is a still cropped to fill a small square. */
export function MoveMedia({ ex, size = 160, className = "", label = false, speed = 1, periodMs, fill = false, still = false, thumb = false }: { ex: Ex; size?: number; className?: string; label?: boolean; speed?: number; periodMs?: number; fill?: boolean; still?: boolean; thumb?: boolean }) {
  const media = moveMedia(ex.slug);
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, { margin: "120px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    const v = ref.current; if (!v) return;
    if (inView && !reduce) { v.playbackRate = periodMs ? Math.max(0.25, Math.min(2, 2500 / periodMs)) * speed : speed; v.play().catch(() => {}); } else v.pause();
  }, [inView, reduce, speed, periodMs]);

  const box = fill ? "absolute inset-0 w-full h-full" : "";
  const style = fill ? undefined : { width: size, height: size };

  if (!media) {
    return <Photo src={exerciseImage({ slug: ex.slug, pattern: ex.pattern, pillar: ex.pillar ?? "strength" }, fill ? 1200 : Math.max(400, size * 2), fill ? 900 : Math.max(400, size * 2))} alt={ex.name} kb className={`${box} ${className}`} style={style} />;
  }
  if (media.loop) {
    const src = (still || thumb || reduce) && media.poster ? media.poster : media.loop;
    // The loops are portrait on a warm studio backdrop: shown whole, so a
    // head or a foot is never cropped off, on the same backdrop colour. Their
    // edges fade into it — several source loops have torn, noisy borders, and
    // a studio vignette is what the eye expects there anyway.
    return (
      <div className={`${fill ? "" : "relative"} overflow-hidden bg-[#e8ece6] ${box} ${className}`} style={style} role="img" aria-label={`${ex.name} demonstration`}>
        <img src={src} alt="" loading="lazy" decoding="async" className={`relative w-full h-full ${thumb ? "object-cover object-top" : "object-contain"}`} style={thumb ? undefined : EDGE_FADE} />
      </div>
    );
  }
  return (
    <div className={`${fill ? "" : "relative"} overflow-hidden ${box} ${className}`} style={style} role="img" aria-label={`${ex.name} demonstration`}>
      <video ref={ref} muted loop playsInline preload="metadata" poster={media.poster} className="w-full h-full object-cover">
        {media.webm && <source src={media.webm} type="video/webm" />}
        {media.mp4 && <source src={media.mp4} type="video/mp4" />}
      </video>
      {label && <span className="absolute bottom-1 right-2 text-[9px] tracking-[.14em] uppercase text-smoke">3D · loop</span>}
    </div>
  );
}
