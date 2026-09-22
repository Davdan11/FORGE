"use client";

import { useEffect } from "react";
import { listenForAuthRedirects } from "@/lib/auth";
import { AUTH_ERROR_EVENT } from "./AccountPanel";

/* Catches Google / Apple sending the athlete back into the native app. The
   session it stores fires SIGNED_IN, which whichever AccountPanel is on
   screen picks up; errors are passed to it the same way. Renders nothing. */
export function AuthBridge() {
  useEffect(() => {
    listenForAuthRedirects(
      () => {},
      (message) => window.dispatchEvent(new CustomEvent(AUTH_ERROR_EVENT, { detail: message })),
    ).catch(() => {});
  }, []);
  return null;
}
