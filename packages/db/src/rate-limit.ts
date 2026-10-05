import { lte, sql } from "drizzle-orm";
import type { Database } from "./client";
import { rateLimits } from "./schema";

export async function consumeRateLimit(
  db: Database,
  key: string,
  now: Date,
  maxCount: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (
    !key ||
    !Number.isInteger(maxCount) ||
    maxCount < 1 ||
    !Number.isInteger(windowSeconds) ||
    windowSeconds < 1 ||
    !Number.isFinite(now.getTime())
  ) {
    throw new RangeError("Invalid rate limit parameters");
  }
  const instant = now.toISOString();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();
  const [limit] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= ${instant}::timestamptz then 1 else least(${rateLimits.count}::bigint + 1, 2147483647)::integer end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= ${instant}::timestamptz then ${resetAt}::timestamptz else ${rateLimits.resetAt} end`,
      },
    })
    .returning();
  if (!limit) throw new Error("Rate limit update failed");
  const allowed = limit.count <= maxCount;
  return {
    allowed,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((new Date(limit.resetAt).getTime() - now.getTime()) / 1000)),
  };
}

export async function clearExpiredRateLimits(db: Database, now: Date): Promise<number> {
  const removed = await db
    .delete(rateLimits)
    .where(lte(rateLimits.resetAt, now.toISOString()))
    .returning({ key: rateLimits.key });
  return removed.length;
}
