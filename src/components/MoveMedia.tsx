"use client";

import { useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { moveMedia } from "@/lib/data/media";
import { exerciseImage } from "@/lib/data/images";
import { Photo } from "./ui";
import type { Exercise, Muscle } from "@/lib/types";

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
    // head or a foot is never cropped off, over a blurred copy of the same
    // frame that fills the rest of the box without a seam.
    return (
      <div className={`${fill ? "" : "relative"} overflow-hidden bg-[#E8DED3] ${box} ${className}`} style={style} role="img" aria-label={`${ex.name} demonstration`}>
        {!thumb && media.poster && <img src={media.poster} alt="" aria-hidden loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-80" />}
        <img src={src} alt="" loading="lazy" decoding="async" className={`relative w-full h-full ${thumb ? "object-cover object-top" : "object-contain"}`} />
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
