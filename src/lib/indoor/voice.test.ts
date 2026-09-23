import { describe, expect, it } from "vitest";
import { chooseLinks, CONNECT_AT, DROP_AT, MAX_LINKS, offersTo, voiceGain, voiceSignal } from "./voice";

describe("voiceGain", () => {
  it("is full voice close by, silent out of earshot, and fades in between", () => {
    expect(voiceGain(0)).toBe(1);
    expect(voiceGain(-20)).toBe(1);
    expect(voiceGain(60)).toBeCloseTo(0.25);
    expect(voiceGain(100)).toBe(0);
    expect(voiceGain(500)).toBe(0);
    expect(voiceGain(40)).toBeGreaterThan(voiceGain(80));
  });
});

describe("chooseLinks", () => {
  const p = (id: string, distance: number, voice = true) => ({ id, distance, voice });
  it("links only riders in voice within reach", () => {
    expect([...chooseLinks(1000, [p("a", 1050), p("b", 1000 + CONNECT_AT + 1), p("c", 1010, false)], new Set())]).toEqual(["a"]);
  });
  it("keeps a link open further out than it opens one, so the edge does not flicker", () => {
    const far = p("a", 1000 + (CONNECT_AT + DROP_AT) / 2);
    expect(chooseLinks(1000, [far], new Set()).size).toBe(0);
    expect(chooseLinks(1000, [far], new Set(["a"])).has("a")).toBe(true);
    expect(chooseLinks(1000, [p("a", 1000 + DROP_AT + 1)], new Set(["a"])).size).toBe(0);
  });
  it("links the nearest few in a big bunch", () => {
    const bunch = Array.from({ length: 20 }, (_, i) => p(`r${i}`, 1000 + i * 3));
    const links = chooseLinks(1000, bunch, new Set());
    expect(links.size).toBe(MAX_LINKS);
    expect(links.has("r0")).toBe(true);
    expect(links.has("r19")).toBe(false);
  });
});

describe("offersTo", () => {
  it("lets exactly one of two riders call", () => {
    expect(offersTo("a", "b")).not.toBe(offersTo("b", "a"));
  });
});

describe("voiceSignal", () => {
  it("accepts well-formed handshakes and nothing else", () => {
    expect(voiceSignal({ k: "offer", sdp: "v=0" })).toEqual({ k: "offer", sdp: "v=0" });
    expect(voiceSignal({ k: "bye" })).toEqual({ k: "bye" });
    expect(voiceSignal({ k: "offer", sdp: "x".repeat(30000) })).toBeNull();
    expect(voiceSignal({ k: "drop tables" })).toBeNull();
    expect(voiceSignal("hello")).toBeNull();
  });
});
