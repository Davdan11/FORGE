import { WORKOUTS } from "@/lib/data/workouts";
import { WorkoutDetail } from "./WorkoutDetail";

/** The guided workouts are a fixed list, so every page can be written out at
 *  build time. See the note in library/[slug]/page.tsx. */
export function generateStaticParams() {
  return WORKOUTS.map((w) => ({ id: w.id }));
}

export default function Page() {
  return <WorkoutDetail />;
}
