import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";
import { Guard } from "@/components/Guard";
import { LevelUpWatcher } from "@/components/LevelUp";
import { XpBurst } from "@/components/XpBurst";
import { BadgeUnlocked } from "@/components/BadgeUnlocked";
import { WatchFeedSync } from "@/components/WatchPanel";
import { LobbyPresence } from "@/components/LobbyPresence";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard>
      <SideNav />
      <main className="flex-1 flex flex-col lg:pl-[240px]">{children}</main>
      <BottomNav />
      <XpBurst />
      <BadgeUnlocked />
      <LevelUpWatcher />
      {/* Keeps the Garmin watch's FORGE screens current (no-op until a watch is paired). */}
      <WatchFeedSync />
      {/* "N online" on each road and the owner's panel: this tab counted, never named. */}
      <LobbyPresence />
    </Guard>
  );
}
