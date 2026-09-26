import { describe, expect, it } from "vitest";
import { badgeContext, indoorFacts, isFtpTest, medalFacts, outdoorFacts, parsePalmares } from "./badgeFacts";
import { BADGES, BADGE_GROUPS, badgeDesc, badgeEmblem, badgeGroup, badgeName, evaluateBadges } from "./gamification";
import type { Activity, BadgeContext, Stats } from "./types";

const stats = (over: Partial<Stats> = {}, totals: Partial<Stats["totals"]> = {}): Stats =>
  ({ id: "me", xp: 0, level: 1, streakWeeks: 0, badges: [], ...over, totals: { sessions: 0, volumeKg: 0, distanceM: 0, mobilityMin: 0, mealsLogged: 0, ...totals } });
const ctx = (over: Partial<BadgeContext> = {}): BadgeContext => ({ bestE1rm: {}, bodyweightKg: 80, zone2Min: 0, ...over });

type Act = Parameters<typeof indoorFacts>[0][number];
type Indoor = NonNullable<NonNullable<Activity["meta"]>["indoor"]>;
const ride = (over: Partial<Indoor>, a: Partial<Act> = {}): Act => ({
  type: "ride", startedAt: "2026-09-01T18:00:00.000Z", distanceM: 20000, durationSec: 3600, elevGainM: 300,
  meta: { discipline: "indoor", indoor: { course: "Polders", quality: "measured", ...over } }, ...a,
});
const run = (km: number, min: number, startedAt = "2026-09-01T18:00:00.000Z"): Act => ({ type: "run", startedAt, distanceM: km * 1000, durationSec: min * 60, elevGainM: 50 });

describe("palmarès parsing", () => {
  const data = {
    segments: [
      { route: 14, start: 0, name: "Lacets", kind: 0, medal: 3 },
      { route: 7, start: 2000, name: "Sprint 1", kind: 1, medal: 3 },
      { route: 7, start: 8000, name: "Sprint 2", kind: 1, medal: 2 },
      { route: 1, start: 500, name: "Portique", kind: 0, medal: 0, demoMedal: 3 },
    ],
    routes: [{ route: 14, finishes: 1 }],
    workouts: [{ id: "ftp20", done: 1 }],
  };

  it("reads the bare JSON the app saves and the game's {data} envelope alike", () => {
    const bare = parsePalmares(JSON.stringify(data));
    const wrapped = parsePalmares(JSON.stringify({ data }));
    expect(bare).toEqual(wrapped);
    expect(bare.segments).toHaveLength(4);
    expect(medalFacts(bare)).toEqual({ gold: 2, climbGold: 1, sprintGold: 1, any: 3 });
  });

  it("treats bad or missing JSON as an empty trophy case", () => {
    for (const raw of [undefined, "", "{not json", "null", "42", "[]", JSON.stringify({ segments: "nope", routes: null })]) {
      expect(medalFacts(parsePalmares(raw))).toEqual({ gold: 0, climbGold: 0, sprintGold: 0, any: 0 });
    }
  });

  it("skips malformed segment rows instead of failing", () => {
    const p = parsePalmares(JSON.stringify({ segments: [null, 3, { medal: "3" }, { medal: 3, kind: 0 }] }));
    expect(medalFacts(p)).toEqual({ gold: 1, climbGold: 1, sprintGold: 0, any: 1 });
  });

  it("does not count demo medals", () => {
    expect(badgeContext({ best: {}, activities: [], weighIns: [], sessions: [], readinessCount: 0, nutrition: [],
      profile: { weightKg: 70, goal: "build", indoorGame: { palmares: JSON.stringify({ data: { segments: [{ kind: 0, medal: 0, demoMedal: 3 }] } }) } } }).medals)
      .toEqual({ gold: 0, climbGold: 0, sprintGold: 0, any: 0 });
  });
});

describe("indoor facts", () => {
  it("counts measured and estimated rides, not effort typed on a slider", () => {
    const f = indoorFacts([ride({}), ride({ quality: "estimated" }), ride({ quality: "declared" }), run(5, 25)]);
    expect(f.rides).toBe(3);
    expect(f.km).toBe(40);
    expect(f.climbM).toBe(600);
    expect(f.hours).toBe(2);
    expect(f.powerRides).toBe(1);
  });

  it("recognises the game's FTP tests in both languages", () => {
    for (const w of ["Test FTP 20 min", "FTP test 20 min", "Test rampe", "Ramp test"]) expect(isFtpTest(w)).toBe(true);
    for (const w of ["Sweet spot 3×10", "Endurance zone 2", "Pyramide", undefined]) expect(isFtpTest(w)).toBe(false);
    const f = indoorFacts([ride({ workout: "Test rampe", workoutDone: true }), ride({ workout: "Ramp test" }), ride({ workout: "Pyramide", workoutDone: true, with: 3 })]);
    expect(f).toMatchObject({ ftpTests: 1, workouts: 2, groupRides: 1 });
  });
});

describe("outdoor facts", () => {
  it("finds the longest plausible run and ignores a drive logged as a run", () => {
    const f = outdoorFacts([run(10, 55), run(21.1, 120), run(42.2, 60), ride({})]);
    expect(f.longestRunM).toBe(21100);
    expect(f.runKm).toBeCloseTo(31.1, 6);
    expect(f.sports).toBe(2);
  });

  it("counts starts before 7 a.m. local time", () => {
    const at = (h: number) => new Date(2026, 8, 1, h, 30).toISOString();
    expect(outdoorFacts([run(5, 30, at(6)), run(5, 30, at(7)), run(5, 30, at(2))]).earlyStarts).toBe(1);
  });
});

describe("new badges", () => {
  it("has a French name and description and a family for every badge, and unique ids", () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(BADGES.length).toBeGreaterThanOrEqual(27 + 50);
    const groups = new Set(BADGE_GROUPS.map((g) => g.key));
    for (const b of BADGES) {
      expect(badgeName(b, "fr"), b.id).not.toBe("");
      expect(badgeDesc(b, "fr"), b.id).not.toBe(b.desc);
      expect(groups.has(badgeGroup(b)), b.id).toBe(true);
    }
  });

  it("wears the bike on FORGE Ride badges only", () => {
    expect(badgeEmblem(BADGES.find((b) => b.id === "col_ventoux")!)).toBe("ride");
    expect(badgeEmblem(BADGES.find((b) => b.id === "everest")!)).toBe("endurance");
  });

  it("unlocks nothing new for an empty account", () => {
    expect(evaluateBadges(stats(), ctx())).toEqual([]);
  });

  it("unlocks session and volume tiers at their thresholds", () => {
    expect(evaluateBadges(stats({}, { sessions: 24 }), ctx())).not.toContain("sessions_25");
    expect(evaluateBadges(stats({}, { sessions: 25 }), ctx())).toContain("sessions_25");
    expect(evaluateBadges(stats({}, { sessions: 100, volumeKg: 250000 }), ctx())).toEqual(expect.arrayContaining(["sessions_25", "sessions_100", "volume_250k"]));
  });

  it("uses the larger of the running total and the saved rows", () => {
    expect(evaluateBadges(stats({}, { checkIns: 3 }), ctx({ checkIns: 7 }))).toContain("checkin_7");
    expect(evaluateBadges(stats({}, { checkIns: 30 }), ctx({ checkIns: 2 }))).toContain("checkin_30");
    expect(evaluateBadges(stats({}, { weighIns: 9 }), ctx())).not.toContain("weighin_10");
  });

  it("awards each real col from the finished routes, and the full set once all are done", () => {
    expect(evaluateBadges(stats({ routesDone: ["c15"] }), ctx())).toContain("col_ventoux");
    const some = evaluateBadges(stats({ routesDone: ["c14", "c15", "c16", "c17", "c18", "c19", "c20", "c21"] }), ctx());
    expect(some).not.toContain("real_all");
    // Every real French road: the first eight, and the Croix de Fer, the Aubisque and the Grand Colombier.
    expect(evaluateBadges(stats({ routesDone: ["c14", "c15", "c16", "c17", "c18", "c19", "c20", "c21", "c29", "c30", "c31"] }), ctx())).toContain("real_all");
    const bar = BADGES.find((b) => b.id === "real_all")!.progress!(stats({ routesDone: ["c14", "c3"] }), ctx());
    expect(bar).toEqual([1, 11]);
  });

  it("awards segment medals from the palmarès", () => {
    const earned = evaluateBadges(stats(), ctx({ medals: { gold: 1, climbGold: 0, sprintGold: 1, any: 1 } }));
    expect(earned).toEqual(expect.arrayContaining(["medal_gold", "medal_sprint"]));
    expect(earned).not.toContain("medal_kom");
  });

  it("awards run distances with a little room for GPS", () => {
    const outdoor = (m: number) => ({ longestRunM: m, runKm: 0, climbM: 0, earlyStarts: 0, sports: 0 });
    expect(evaluateBadges(stats(), ctx({ outdoor: outdoor(9960) }))).toContain("run_10k");
    expect(evaluateBadges(stats(), ctx({ outdoor: outdoor(21090) }))).toEqual(expect.arrayContaining(["run_10k", "run_half"]));
    expect(evaluateBadges(stats(), ctx({ outdoor: outdoor(21090) }))).not.toContain("run_marathon");
  });
});
