import { and, eq } from "drizzle-orm";
import { cases, organizations, type Database } from "@avanti/db";
import type { CaseRow } from "./dossier";

// Acquire before case locks: a withdrawal excludes campaign creation and updates
// every retained copy of the preference in the explicitly linked family.
export async function lockRenewalConsent(db: Database, row: CaseRow) {
  await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, row.organizationId))
    .for("no key update");
}
export async function setRenewalConsent(db: Database, row: CaseRow, consented: boolean, now: Date) {
  await db
    .update(cases)
    .set({ renewalContactConsentAt: consented ? now.toISOString() : null })
    .where(
      and(
        eq(cases.organizationId, row.organizationId),
        !consented && row.familyId ? eq(cases.familyId, row.familyId) : eq(cases.id, row.id),
      ),
    );
}
