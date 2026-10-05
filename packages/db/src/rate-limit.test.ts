import { expect, it } from "vitest";
import { createDatabase } from "./client";
import { clearExpiredRateLimits, consumeRateLimit } from "./rate-limit";

it("atomically limits concurrent requests and resets at the exact window boundary", async () => {
  const { db, close } = await createDatabase({ memory: true });
  try {
    const clock = new Date("2027-01-01T10:00:00Z");
    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeRateLimit(db, "hashed-key", clock, 3, 60)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(
      results
        .filter((result) => !result.allowed)
        .every((result) => result.retryAfterSeconds === 60),
    ).toBe(true);
    expect((await consumeRateLimit(db, "another-route", clock, 3, 60)).allowed).toBe(true);
    expect(
      await consumeRateLimit(db, "hashed-key", new Date("2027-01-01T10:01:00Z"), 3, 60),
    ).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(await clearExpiredRateLimits(db, new Date("2027-01-01T10:01:00Z"))).toBe(1);
    expect(await clearExpiredRateLimits(db, new Date("2027-01-01T10:02:00Z"))).toBe(1);
  } finally {
    await close();
  }
});
