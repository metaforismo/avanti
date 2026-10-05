import { lte, or, sql } from "drizzle-orm";
import { clearExpiredRateLimits, sessions } from "@avanti/db";
import type { MiddlewareHandler } from "hono";
import type { ApiEnv, Services } from "../context";
import { retryStorageDeletions } from "../storage-cleanup";
import { safeError } from "../logging";
export function maintenance(s: Services): MiddlewareHandler<ApiEnv> {
  let nextRun = 0;
  return async (c, next) => {
    const now = s.clock();
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && now.getTime() >= nextRun) {
      nextRun = now.getTime() + 60000;
      try {
        await s.db
          .delete(sessions)
          .where(
            or(
              lte(sessions.expiresAt, now.toISOString()),
              sql`${sessions.createdAt} + interval '12 hours' <= ${now.toISOString()}::timestamptz`,
            ),
          );
        await clearExpiredRateLimits(s.db, now);
        await retryStorageDeletions(s);
      } catch (error) {
        nextRun = 0;
        (s.errorLogger ?? console.error)({ requestId: c.get("requestId"), ...safeError(error) });
      }
    }
    await next();
  };
}
