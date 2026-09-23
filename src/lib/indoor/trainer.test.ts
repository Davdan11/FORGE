import { describe, expect, it } from "vitest";
import {
  CP_SERVICE, CSC_SERVICE, FEC_SERVICE, FTMS_SERVICE, SPEED_CURVES, chooseProtocol, cleanName, fecControl, ftmsControl,
  guessBrand, normUuid, powerFromCurve, trainerLabel, wahooControl, type ControlResult,
} from "./trainer";
import { powerFromSpeed } from "./physics";

const hex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join(" ");

describe("protocol choice", () => {
  const pick = (services: string[], wahooControl = false) => chooseProtocol({ services, wahooControl });

  it("prefers FTMS over everything, including on a Tacx that also has FE-C", () => {
    expect(pick([CP_SERVICE, FEC_SERVICE, FTMS_SERVICE, CSC_SERVICE], true)).toBe("ftms");
  });
  it("uses FE-C on a Tacx without FTMS firmware", () => {
    expect(pick([CP_SERVICE, FEC_SERVICE])).toBe("tacx-fec");
  });
  it("uses the Wahoo protocol only when its characteristic is there", () => {
    expect(pick([CP_SERVICE], true)).toBe("wahoo-legacy");
    expect(pick([CP_SERVICE], false)).toBe("power-only");
  });
  it("falls back to speed, then to nothing", () => {
    expect(pick([CSC_SERVICE])).toBe("speed-only");
    expect(pick([CP_SERVICE, CSC_SERVICE])).toBe("power-only");
    expect(pick(["0000180d-0000-1000-8000-00805f9b34fb"])).toBeNull();
  });
  it("accepts short and upper-case UUIDs", () => {
    expect(normUuid("1826")).toBe(FTMS_SERVICE);
    expect(normUuid(0x1818)).toBe(CP_SERVICE);
    expect(pick(["00001826-0000-1000-8000-00805F9B34FB"])).toBe("ftms");
    expect(pick([FEC_SERVICE.toUpperCase()])).toBe("tacx-fec");
  });
});

describe("brand and label (display only)", () => {
  it.each([
    ["KICKR CORE 5A2B", "Wahoo"], ["Wahoo KICKR SNAP", "Wahoo"], ["Tacx Neo 2T 12345", "Tacx"], ["Tacx Flux S", "Tacx"],
    ["DIRETO XR 01234", "Elite"], ["SUITO-T", "Elite"], ["Saris H3", "Saris"], ["CycleOps Hammer", "Saris"],
    ["Zwift Hub", "Zwift"], ["Van Rysel D500", "Van Rysel"], ["D100 1234", "Van Rysel"], ["JetBlack Volt", "JetBlack"],
    ["Magene T300", "Magene"], ["THINKRIDER X7", "Thinkrider"], ["Wattbike Atom", "Wattbike"], ["Stages Bike", "Stages"],
    ["Keiser M3i", "Keiser"], ["Kinetic R1", "Kinetic"], ["XYZ-9000", null],
  ])("%s → %s", (name, brand) => expect(guessBrand(name)).toBe(brand));

  it("drops the serial and adds the brand when the name lacks it", () => {
    expect(cleanName("Tacx Neo 2T 12345")).toBe("Tacx Neo 2T");
    expect(cleanName("Tacx Flux 2")).toBe("Tacx Flux 2");
    expect(trainerLabel("Tacx Neo 2T 12345", "tacx-fec")).toBe("Tacx Neo 2T · FE-C");
    expect(trainerLabel("KICKR CORE 5A2B", "wahoo-legacy")).toBe("Wahoo KICKR CORE · Wahoo");
    expect(trainerLabel("DIRETO XR 01234", "ftms")).toBe("Elite DIRETO XR · FTMS");
    expect(trainerLabel(undefined, "speed-only")).toBe("Trainer · speed only");
    expect(trainerLabel("Zwift Hub", "ftms", { ftms: "FTMS", "tacx-fec": "FE-C", "wahoo-legacy": "Wahoo", "power-only": "puissance", "speed-only": "vitesse" })).toBe("Zwift Hub · FTMS");
  });
});

/** A fake link that records what was written. */
function recorder(fail = false) {
  const writes: string[] = [];
  const write = async (b: Uint8Array) => { writes.push(hex(b)); if (fail) throw new Error("gatt"); };
  return { writes, write };
}

describe("FTMS through the abstraction — the same bytes as before", () => {
  it("start = request control, then start; grade and ERG are the FTMS commands", async () => {
    const sent: string[] = [];
    const send = async (b: Uint8Array): Promise<ControlResult> => { sent.push(hex(b)); return { ok: true, result: 1 }; };
    const t = ftmsControl(send);
    expect(await t.start()).toEqual({ ok: true, result: 1 });
    await t.setGrade(5);
    await t.setTargetPower(250);
    await t.stop();
    expect(sent).toEqual(["00", "07", "11 00 00 f4 01 28 33", "05 fa 00", "08 01"]);
  });

  it("does not send start when control is refused", async () => {
    const sent: string[] = [];
    const t = ftmsControl(async (b) => { sent.push(hex(b)); return { ok: false, result: 5 }; });
    expect(await t.start()).toEqual({ ok: false, result: 5 });
    expect(sent).toEqual(["00"]);
  });
});

describe("FE-C through the abstraction", () => {
  it("sends user config on start, track resistance for grade, target power for ERG, flat on stop", async () => {
    const r = recorder();
    const t = fecControl(r.write, { riderKg: 75, bikeKg: 8 });
    await t.start(); await t.setGrade(5); await t.setTargetPower(250); await t.stop();
    expect(r.writes.map((w) => w.slice(12, 14))).toEqual(["37", "33", "31", "33"]);
    expect(r.writes[1]).toBe("a4 09 4e 05 33 ff ff ff ff 14 50 50 c1");
  });

  it("reports a failed write instead of throwing", async () => {
    expect(await fecControl(recorder(true).write).setGrade(1)).toEqual({ ok: false, result: 0 });
  });
});

describe("Wahoo legacy through the abstraction", () => {
  it("unlocks, initialises simulation once, and re-initialises after ERG", async () => {
    const r = recorder();
    const t = wahooControl(r.write, { riderKg: 75, bikeKg: 8 });
    await t.start();
    await t.setGrade(5);
    await t.setGrade(6);
    await t.setTargetPower(200);
    await t.setGrade(0);
    expect(r.writes.map((w) => w.slice(0, 2))).toEqual(["20", "43", "46", "46", "42", "43", "46"]);
    expect(r.writes[1]).toBe("43 6c 20 04 00 fe 01"); // 83 kg total
  });

  it("stops at the first failure", async () => {
    const r = recorder(true);
    expect(await wahooControl(r.write).start()).toEqual({ ok: false, result: 0 });
    expect(r.writes).toEqual(["20 ee fc"]);
  });
});

describe("speed → power curves (estimated)", () => {
  const mph = (m: number) => m / 2.2369362920544;

  it("Kurt Kinetic Road Machine: 5.244820·mph + 0.019168·mph³", () => {
    expect(powerFromCurve(mph(20), "kurt-kinetic-road-machine")).toEqual({ watts: 258, quality: "estimated" });
    expect(powerFromCurve(mph(10), "kurt-kinetic-road-machine").watts).toBe(72); // 52.45 + 19.17
  });

  it("the generic curve is exactly powerFromSpeed", () => {
    for (const v of [0, 3, 8, 12]) expect(powerFromCurve(v, "generic").watts).toBe(powerFromSpeed(v).watts);
  });

  it("every curve rises with speed, starts at zero and is capped", () => {
    for (const c of SPEED_CURVES) {
      expect(powerFromCurve(0, c.id).watts).toBe(0);
      expect(powerFromCurve(10, c.id).watts).toBeGreaterThan(powerFromCurve(5, c.id).watts);
      expect(powerFromCurve(40, c.id).watts).toBeLessThanOrEqual(900);
      expect(powerFromCurve(-2, c.id).watts).toBe(0);
    }
  });
});
