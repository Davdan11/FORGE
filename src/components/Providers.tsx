"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Global motion policy: honour the OS reduced-motion setting everywhere. */
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
