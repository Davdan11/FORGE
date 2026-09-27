import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";

// The browser's DOMParser, for tests in Node.
(globalThis as unknown as { DOMParser: unknown }).DOMParser = DOMParser;
import { parseTrackFile, TrackError } from "./track";

const gpx = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>Morning Run</name><type>running</type><trkseg>
<trkpt lat="45.5000" lon="-73.5700"><ele>30</ele><time>2026-09-01T10:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>120</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="45.5010" lon="-73.5700"><ele>32</ele><time>2026-09-01T10:00:30Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
</trkseg></trk></gpx>`;

const tcx = `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>2026-09-02T08:00:00Z</Id><Lap><Track>
<Trackpoint><Time>2026-09-02T08:00:00Z</Time><Position><LatitudeDegrees>46.8</LatitudeDegrees><LongitudeDegrees>-71.2</LongitudeDegrees></Position><AltitudeMeters>50</AltitudeMeters><HeartRateBpm><Value>110</Value></HeartRateBpm></Trackpoint>
<Trackpoint><Time>2026-09-02T08:01:00Z</Time><Position><LatitudeDegrees>46.81</LatitudeDegrees><LongitudeDegrees>-71.2</LongitudeDegrees></Position><AltitudeMeters>55</AltitudeMeters><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

describe("GPX / TCX import", () => {
  it("reads a Strava GPX run with heart rate", () => {
    const r = parseTrackFile(gpx, "a.gpx");
    expect(r.type).toBe("run");
    expect(r.points).toHaveLength(2);
    expect(r.points[1].alt).toBe(32);
    expect(r.hr).toEqual([[0, 120], [30, 140]]);
    expect(r.name).toBe("Morning Run");
    expect(r.startedAt).toBe("2026-09-01T10:00:00.000Z");
  });
  it("reads a Garmin TCX ride", () => {
    const r = parseTrackFile(tcx, "b.tcx");
    expect(r.type).toBe("ride");
    expect(r.points).toHaveLength(2);
    expect(r.hr[1]).toEqual([60, 130]);
  });
  it("refuses something that isn't a track", () => {
    expect(() => parseTrackFile("<html></html>")).toThrow(TrackError);
  });
});
