import { timingSafeEqual } from "node:crypto";
import { lte, or, sql } from "drizzle-orm";
import { clearExpiredRateLimits, sessions } from "@avanti/db";
import type { App, Services } from "../context";
import { retryStorageDeletions } from "../storage-cleanup";
import { ApiFailure } from "../security";

export function mountMaintenance(app: App, s: Services) {
  let nextRun = 0;
  app.get("/cron/maintenance", async (c) => {
    const provided = Buffer.from(c.req.header("Authorization") ?? "");
    const expected = Buffer.from(`Bearer ${s.cronSecret ?? ""}`);
    if (
      !s.cronSecret ||
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    )
      throw new ApiFailure("unauthorized", 401, "Accesso non autorizzato.");
    const now = s.clock();
    if (now.getTime() < nextRun) return c.json({ ok: true, skipped: true });
    nextRun = now.getTime() + 60000;
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
    return c.json({ ok: true });
  });
}
