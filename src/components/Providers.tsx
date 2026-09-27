"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { AuthBridge } from "./AuthBridge";
import { NativeHaptics } from "./NativeHaptics";

/** Global motion policy: honour the OS reduced-motion setting everywhere. */
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}<AuthBridge /><NativeHaptics /></MotionConfig>;
}
