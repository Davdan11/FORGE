import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, parseBackup, type Backup } from "./backup";

/* parseBackup is the gate between a file someone picked and wiping their
   device to restore it. Every rejection here is a device not destroyed. */

const valid: Backup = {
  app: "forge",
  version: BACKUP_VERSION,
  exportedAt: "2026-01-05T10:00:00.000Z",
  tables: { profile: [{ id: "p1", name: "Test" }], sessions: [] },
};

describe("parseBackup", () => {
  it("accepts a backup this version wrote", () => {
    const b = parseBackup(JSON.stringify(valid));
    expect(b.app).toBe("forge");
    expect(b.tables.profile).toHaveLength(1);
  });

  it("rejects a file that isn’t JSON", () => {
    expect(() => parseBackup("not json at all")).toThrow(/valid JSON/i);
    expect(() => parseBackup("")).toThrow(/valid JSON/i);
  });

  it("rejects valid JSON that isn’t a FORGE backup", () => {
    expect(() => parseBackup(JSON.stringify({ hello: "world" }))).toThrow(/FORGE backup/i);
    expect(() => parseBackup(JSON.stringify({ app: "other", version: 1, tables: {} }))).toThrow(/FORGE backup/i);
    expect(() => parseBackup("null")).toThrow(/FORGE backup/i);
  });

  it("rejects a backup missing its tables rather than silently wiping the device", () => {
    expect(() => parseBackup(JSON.stringify({ app: "forge", version: 1 }))).toThrow(/FORGE backup/i);
  });

  it("refuses a backup from a newer version it cannot understand", () => {
    expect(() => parseBackup(JSON.stringify({ ...valid, version: BACKUP_VERSION + 1 }))).toThrow(/newer version/i);
  });

  it("refuses a backup with no version number", () => {
    expect(() => parseBackup(JSON.stringify({ app: "forge", tables: {} }))).toThrow(/newer version|FORGE backup/i);
  });

  it("accepts an older backup, so an old file still restores", () => {
    expect(() => parseBackup(JSON.stringify({ ...valid, version: 0 }))).not.toThrow();
  });
});
