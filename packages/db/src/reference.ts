import { sql } from "drizzle-orm";
import type { Database } from "./client";
import { referenceCounters } from "./schema";

export async function nextReference(
  db: Database,
  organizationId: string,
  year: number,
): Promise<string> {
  if (!Number.isInteger(year) || year < 2000 || year > 9999)
    throw new RangeError("Invalid reference year");
  const [counter] = await db
    .insert(referenceCounters)
    .values({ organizationId, year, value: 1 })
    .onConflictDoUpdate({
      target: [referenceCounters.organizationId, referenceCounters.year],
      set: { value: sql`${referenceCounters.value} + 1` },
    })
    .returning({ value: referenceCounters.value });
  if (!counter) throw new Error("Reference allocation failed");
  return `AV-${year}-${String(counter.value).padStart(6, "0")}`;
}
