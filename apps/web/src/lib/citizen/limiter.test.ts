import { describe, expect, it } from "vitest";
import { createLimiter } from "./limiter";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createLimiter", () => {
  it("never runs more than the limit and keeps the order", async () => {
    const run = createLimiter(2);
    let running = 0;
    let peak = 0;
    const started: number[] = [];
    const releases: (() => void)[] = [];
    const tasks = [0, 1, 2, 3, 4].map((n) =>
      run(async () => {
        started.push(n);
        running += 1;
        peak = Math.max(peak, running);
        await new Promise<void>((resolve) => releases.push(resolve));
        running -= 1;
        return n;
      }),
    );
    await tick();
    expect(started).toEqual([0, 1]);
    releases.shift()!();
    await tick();
    // A task queued now must not overtake the ones already waiting.
    const late = run(async () => "late");
    releases.shift()!();
    await tick();
    expect(started).toEqual([0, 1, 2, 3]);
    while (releases.length) {
      releases.shift()!();
      await tick();
    }
    expect(await Promise.all(tasks)).toEqual([0, 1, 2, 3, 4]);
    expect(await late).toBe("late");
    expect(peak).toBe(2);
  });

  it("frees the slot when a task fails", async () => {
    const run = createLimiter(1);
    await expect(run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(await run(async () => "next")).toBe("next");
  });
});
