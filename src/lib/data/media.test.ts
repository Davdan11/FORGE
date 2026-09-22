import { describe, expect, it } from "vitest";
import manifest from "../../../public/moves/manifest.json";
import { getExercise } from "./exercises";

/* Every animation in public/moves must belong to a movement in the bank,
   or it sits on disk and nobody ever sees it. */
describe("exercise loops", () => {
  it("each loop is named after an exercise that exists", () => {
    const orphans = Object.keys(manifest).filter((slug) => !getExercise(slug));
    expect(orphans).toEqual([]);
  });
});
