import { describe, it, expect, vi, afterEach } from "vitest";
import { reconnectingTrainer, type TrainerSetup } from "./transport";

const ok = { ok: true, result: 1 } as const;
function fake(label: string, log: string[]): TrainerSetup {
  return {
    trainer: {
      protocol: "ftms", label, canControl: true,
      commands: {
        start: async () => { log.push(`${label}:start`); return ok; },
        stop: async () => ok,
        setGrade: async (p: number) => { log.push(`${label}:grade ${p}`); return ok; },
        setTargetPower: async (w: number) => { log.push(`${label}:erg ${w}`); return ok; },
      },
    },
    control: undefined,
    stop: () => log.push(`${label}:stop`),
  } as unknown as TrainerSetup;
}

afterEach(() => vi.useRealTimers());

describe("reconnectingTrainer", () => {
  it("takes the trainer back after a drop and keeps the ride's commands working", async () => {
    vi.useFakeTimers();
    const log: string[] = [], links: boolean[] = [];
    const kept = reconnectingTrainer(fake("a", log), async () => fake("b", log), () => {}, undefined, { onLink: (up) => links.push(up) });
    await kept.trainer.commands!.setGrade(3);
    kept.dropped();
    expect(links).toEqual([false]);
    await vi.advanceTimersByTimeAsync(1100);
    expect(links).toEqual([false, true]);
    await kept.trainer.commands!.setGrade(5);
    expect(log).toEqual(["a:grade 3", "a:stop", "b:start", "b:grade 5"]);
  });

  it("keeps trying while the trainer is away, then reports it lost", async () => {
    vi.useFakeTimers();
    const lost = vi.fn(), log: string[] = [];
    let tries = 0;
    const kept = reconnectingTrainer(fake("a", log), async () => { tries++; throw new Error("asleep"); }, () => {}, lost);
    kept.dropped();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tries).toBeGreaterThan(20);
    expect(lost).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    expect(lost).toHaveBeenCalledOnce();
  });
});
