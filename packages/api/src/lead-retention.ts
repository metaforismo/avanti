import { inArray, lt } from "drizzle-orm";
import { leads, type Database } from "@avanti/db";

/**
 * Pilot applications from the site: a contact to call back, not a customer record. Two years
 * cover a pilot season and the next one; a CAF that signs keeps its own contract records.
 * Their outbox rows go with them (FK cascade). See docs/SECURITY.md.
 */
export const LEAD_RETENTION_DAYS = 730;
export const LEAD_RETENTION_BATCH = 500;

export async function purgeLeads(db: Database, now: Date) {
  const cutoff = new Date(now.getTime() - LEAD_RETENTION_DAYS * 86400000).toISOString();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(lt(leads.createdAt, cutoff))
      .orderBy(leads.createdAt, leads.id)
      .limit(LEAD_RETENTION_BATCH)
      .for("update", { skipLocked: true });
    if (rows.length)
      await tx.delete(leads).where(
        inArray(
          leads.id,
          rows.map((r) => r.id),
        ),
      );
    return rows.length;
  });
}
