import { describe, expect, it } from "vitest";
import { emptyStreams, pushSample, toTcx } from "./tcx";
import { boardMessage, canPost } from "./leaderboard";

describe("TCX export of an indoor ride", () => {
  const s = emptyStreams();
  pushSample(s, { t: 0, d: 0, alt: 35, w: 200, hr: 120, cad: 85 });
  pushSample(s, { t: 1, d: 9.2, alt: 35.1, w: 210, hr: null, cad: null });
  const xml = toTcx({ startedAt: "2026-09-23T12:00:00.000Z", title: "Col du Géant <test>", durationSec: 1, distanceM: 9.2, kcal: 1 }, s);

  it("writes one trackpoint a second with time, distance and power", () => {
    expect(xml.match(/<Trackpoint>/g)).toHaveLength(2);
    expect(xml).toContain("<Time>2026-09-23T12:00:01.000Z</Time>");
    expect(xml).toContain("<Watts>210</Watts>");
    expect(xml).toContain("<Speed>9.2</Speed>");
  });

  it("leaves out readings that were not there, and never writes a GPS position", () => {
    expect(xml.match(/<HeartRateBpm>/g)).toHaveLength(1);
    expect(xml).not.toContain("LatitudeDegrees");
  });

  it("escapes the title", () => {
    expect(xml).toContain("&lt;test&gt;");
  });
});

describe("world segment boards", () => {
  it("only takes measured, possible times", () => {
    expect(canPost({ quality: "measured", seconds: 300, lengthM: 3000, segment: "c8:3000" })).toBe(true);
    expect(canPost({ quality: "estimated", seconds: 300, lengthM: 3000, segment: "c8:3000" })).toBe(false);
    expect(canPost({ quality: "measured", seconds: 30, lengthM: 3000, segment: "c8:3000" })).toBe(false); // 100 m/s
    expect(canPost({ quality: "measured", seconds: 300, lengthM: 3000, segment: "drop table" })).toBe(false);
  });

  it("tells the game where the rider ranks", () => {
    const rows = [
      { rank: 1, user_id: "x", name: "Léa", seconds: 280, category: "B", riders: 40 },
      { rank: 12, user_id: "me", name: "David", seconds: 301, category: "B", riders: 40 },
    ];
    expect(boardMessage(rows, "me", "c8:3000", "Col", "B")).toMatchObject({ type: "leaderboard", place: 12, of: 40, category: "B" });
  });
});
