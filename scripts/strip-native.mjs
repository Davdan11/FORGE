// After the native export: take the 3D game out of the phone apps' bundle. It is ~300 MB (over Google Play's
// size cap) and the apps load it from the website instead (NEXT_PUBLIC_GAME_HOST, see UnityRide.tsx).
import { rmSync, existsSync } from "node:fs";

const game = "out/unity";
if (existsSync(game)) {
  rmSync(game, { recursive: true, force: true });
  console.log("strip-native: removed out/unity (loaded from", process.env.NEXT_PUBLIC_GAME_HOST || "the website", ")");
}
if (!process.env.NEXT_PUBLIC_GAME_HOST) console.warn("strip-native: NEXT_PUBLIC_GAME_HOST is not set, the indoor game won't load in the apps");
