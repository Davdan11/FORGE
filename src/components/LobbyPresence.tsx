"use client";

import { useEffect } from "react";
import { setWhere } from "@/lib/indoor/lobby";

/** Counts this signed-in tab as "in the app" in the lobby (lib/indoor/lobby); the game screens say more while riding. */
export function LobbyPresence() {
  useEffect(() => {
    void setWhere({ w: "app" });
    return () => { void setWhere(null); };
  }, []);
  return null;
}
