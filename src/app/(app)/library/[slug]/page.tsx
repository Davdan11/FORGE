import { EXERCISES } from "@/lib/data/exercises";
import { ExerciseDetail } from "./ExerciseDetail";

/* A server component whose only job is to list the slugs at build time.

   The movement bank is fixed and known before anyone installs the app, so
   every one of these pages can be written out as a file — which is what a
   static export, and therefore the iOS and Android builds, require. The page
   itself is still entirely client-side; it just needed a server file above it
   to say which slugs exist. */
export function generateStaticParams() {
  return EXERCISES.map((e) => ({ slug: e.slug }));
}

export default function Page() {
  return <ExerciseDetail />;
}
