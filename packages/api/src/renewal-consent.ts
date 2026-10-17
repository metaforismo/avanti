import { and, eq } from "drizzle-orm";
import { cases, organizations, type Database } from "@avanti/db";
import { RENEWAL_CONSENT_VERSIONS } from "@avanti/core";
import type { CaseRow } from "./dossier";
import { eraseRenewalReminders, type RenewalOwner } from "./renewal-reminders";

// Tenant first, before case/reminder locks: retention, withdrawal and creation serialize.
export async function lockRenewalConsent(db: Database, row: Pick<CaseRow, "organizationId">) {
  await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, row.organizationId))
    .for("no key update");
}
export async function withdrawRenewalConsent(db: Database, row: RenewalOwner, now: Date) {
  await db
    .update(cases)
    .set({
      renewalContactConsentAt: null,
      renewalContactConsentVersion: null,
      renewalContactRevokedAt: now.toISOString(),
    })
    .where(
      and(
        eq(cases.organizationId, row.organizationId),
        row.familyId ? eq(cases.familyId, row.familyId) : eq(cases.id, row.id),
      ),
    );
  await eraseRenewalReminders(db, row);
}
export async function setRenewalConsent(db: Database, row: CaseRow, consented: boolean, now: Date) {
  if (!consented) return withdrawRenewalConsent(db, row, now);
  await db
    .update(cases)
    .set({
      renewalContactConsentAt: now.toISOString(),
      renewalContactConsentVersion: RENEWAL_CONSENT_VERSIONS[row.language],
      renewalContactRevokedAt: null,
    })
    .where(and(eq(cases.organizationId, row.organizationId), eq(cases.id, row.id)));
}
