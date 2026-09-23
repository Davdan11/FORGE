import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";
import { Guard } from "@/components/Guard";
import { LevelUpWatcher } from "@/components/LevelUp";
import { XpBurst } from "@/components/XpBurst";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard>
      <SideNav />
      <main className="flex-1 flex flex-col lg:pl-[240px]">{children}</main>
      <BottomNav />
      <XpBurst />
      <LevelUpWatcher />
    </Guard>
  );
}
