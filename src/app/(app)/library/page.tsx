"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EXERCISES, searchExercises } from "@/lib/data/exercises";
import { ART } from "@/lib/data/images";
import { MoveMedia } from "@/components/MoveMedia";
import { Screen, Hero, ScreenSkeleton, Rail } from "@/components/ui";
import { Page, Stagger, Item, Press } from "@/components/motion";

const PATTERNS = [["", "All"], ["squat", "Squat"], ["hinge", "Hinge"], ["push_h", "Push"], ["push_v", "Overhead"], ["pull_h", "Row"], ["pull_v", "Pull-up"], ["lunge", "Single-leg"], ["core", "Core"], ["carry", "Carry"], ["power", "Power"], ["cardio", "Cardio"], ["mobility", "Mobility"]] as const;

export default function LibraryPage() {
  return <Suspense fallback={<ScreenSkeleton />}><Library /></Suspense>;
}

function Library() {
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [pattern, setPattern] = useState<string>(params.get("pattern") ?? "");
  const list = searchExercises(q, { pattern: pattern || undefined });
  return (
    <Page>
      <Screen>
        <Hero image={ART.library} color height="h-[260px]" eyebrow={`${EXERCISES.length} movements · cues · faults · swaps`} title={<>The <em>bank.</em></>}>
          <input className="input mt-4 !bg-[rgba(255,255,255,.92)] !text-ink backdrop-blur-md" placeholder="Search a movement, muscle or pattern" value={q} onChange={(e) => setQ(e.target.value)} />
        </Hero>
        <Rail active={pattern} gutter className="gap-2 pb-3 mb-4 lg:mx-0 lg:px-0 lg:flex-wrap lg:overflow-visible">
          {PATTERNS.map(([v, label]) => <button key={v} type="button" aria-pressed={pattern === v} onClick={() => setPattern(v)} className={`chip shrink-0 ${pattern === v ? "chip--volt" : ""}`}>{label}</button>)}
        </Rail>
        <Stagger className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4" delay={0.03}>
          {list.map((e) => (
            <Item key={e.slug}>
              <Press>
                <Link href={`/library/${e.slug}`} className="card--photo block aspect-[4/5]">
                  <MoveMedia ex={e} fill />
                  <div className="on-photo absolute inset-x-0 bottom-0 z-10 p-3 grid gap-1 bg-gradient-to-t from-ink via-ink/85 to-transparent">
                    <span className="flex gap-1"><span className="chip chip--live backdrop-blur-md">{e.level === "new" ? "Beginner" : e.level === "intermediate" ? "Inter." : "Adv."}</span></span>
                    <span className="font-semibold leading-tight">{e.name}</span>
                    <span className="text-[11px] text-bone/70 truncate">{e.primary.join(", ")}</span>
                  </div>
                </Link>
              </Press>
            </Item>
          ))}
        </Stagger>
        {list.length === 0 && <p className="py-8 text-center text-sm text-smoke">Nothing matches. Try a muscle: “glutes”, “lats”…</p>}
      </Screen>
    </Page>
  );
}
