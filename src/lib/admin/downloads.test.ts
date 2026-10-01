import { describe, it, expect } from "vitest";
import { downloadStats } from "./downloads";

const L = (ip: string, path: string, status: number, bytes: number, agent = "Mozilla/5.0 Chrome/140", when = "30/Sep/2026:21:01:33 -0400") =>
  `${ip} - - [${when}] "GET ${path} HTTP/1.1" ${status} ${bytes} "-" "${agent}"`;

describe("downloadStats", () => {
  const sizes = { "FORGE-Ride-Setup.exe": 1000, "FORGE-Ride-Setup-0.2.3.exe": 1000 };

  it("counts a download in pieces as one, and an abandoned one apart", () => {
    const s = downloadStats([
      L("1.1.1.1", "/downloads/FORGE-Ride-Setup.exe", 200, 1000),
      L("2.2.2.2", "/downloads/FORGE-Ride-Setup.exe", 206, 500),
      L("2.2.2.2", "/downloads/FORGE-Ride-Setup.exe", 206, 480),
      L("3.3.3.3", "/downloads/FORGE-Ride-Setup.exe", 200, 40),
      L("4.4.4.4", "/", 200, 1000),
    ], sizes);
    expect(s.complete).toBe(2);
    expect(s.partial).toBe(1);
    expect(s.byFile["FORGE-Ride-Setup.exe"]).toBe(2);
    expect(s.byDay).toEqual([{ day: "2026-09-30", downloads: 2, updates: 0, launches: 0 }]);
  });

  it("tells the game's updater and its launches apart from people", () => {
    const unity = "UnityPlayer/6000.2.4f1 (UnityWebRequest/1.0, libcurl/8.5.0-DEV)";
    const s = downloadStats([
      L("5.5.5.5", "/downloads/FORGE-Ride-Setup-0.2.3.exe", 200, 1000, unity, "01/Oct/2026:07:00:00 -0400"),
      L("5.5.5.5", "/downloads/version.json?t=1", 200, 200, unity, "01/Oct/2026:07:00:00 -0400"),
      L("6.6.6.6", "/downloads/version.json?t=2", 200, 200, unity, "01/Oct/2026:08:00:00 -0400"),
      L("6.6.6.6", "/downloads/version.json?t=3", 200, 200, unity, "01/Oct/2026:09:00:00 -0400"),
    ], sizes);
    expect(s.complete).toBe(0);
    expect(s.updates).toBe(1);
    expect(s.byDay).toEqual([{ day: "2026-10-01", downloads: 0, updates: 1, launches: 2 }]);
  });

  it("leaves out the addresses it is told to (the owner's own tests)", () => {
    const s = downloadStats([L("9.9.9.9", "/downloads/FORGE-Ride-Setup.exe", 200, 1000)], sizes, ["9.9.9.9"]);
    expect(s.complete).toBe(0);
  });
});
