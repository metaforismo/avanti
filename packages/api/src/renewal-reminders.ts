import { and, eq, gt, lte } from "drizzle-orm";
import { renewalReminders, type Database } from "@avanti/db";
import {
  buildHousehold,
  minimalRenewalHousehold,
  practiceYear,
  renewalReminderExpiry,
} from "@avanti/core";
import type { CaseRow } from "./dossier";

export type ReminderRow = typeof renewalReminders.$inferSelect;
export type RenewalOwner = Pick<CaseRow, "id" | "organizationId" | "familyId" | "reference">;

// Caller owns tenant and case locks. This is the only writer of reminder payloads.
export async function preserveRenewalReminder(db: Database, row: CaseRow, now: Date) {
  const year = practiceYear(row.answers);
  const expiresAt = renewalReminderExpiry(year);
  if (
    row.practiceId !== "isee_ordinario" ||
    // No campaign can be created beyond the maximum supported target year (2100).
    year >= 2100 ||
    !row.submittedAt ||
    !row.renewalContactConsentAt ||
    !row.renewalContactConsentVersion ||
    !row.contact ||
    (!row.contact.email && !row.contact.phone) ||
    Date.parse(expiresAt) <= now.getTime()
  )
    return;
  const contact = {
    ...(row.contact.firstName ? { firstName: row.contact.firstName } : {}),
    ...(row.contact.lastName ? { lastName: row.contact.lastName } : {}),
    ...(row.contact.email ? { email: row.contact.email } : {}),
    ...(row.contact.phone ? { phone: row.contact.phone } : {}),
  };
  await db
    .insert(renewalReminders)
    .values({
      sourceCaseId: row.id,
      organizationId: row.organizationId,
      officeId: row.officeId,
      familyId: row.familyId ?? row.id,
      reference: row.reference,
      language: row.language,
      practiceYear: year,
      contact,
      household: minimalRenewalHousehold(buildHousehold(row.answers)),
      consentAt: row.renewalContactConsentAt,
      consentVersion: row.renewalContactConsentVersion,
      withdrawalTokenHash: row.tokenHash,
      expiresAt,
    })
    .onConflictDoNothing();
}

export function reminderFamily(row: RenewalOwner) {
  return and(
    eq(renewalReminders.organizationId, row.organizationId),
    eq(renewalReminders.familyId, row.familyId ?? row.id),
  );
}
export async function eraseRenewalReminders(db: Database, row: RenewalOwner) {
  return db
    .delete(renewalReminders)
    .where(reminderFamily(row))
    .returning({ id: renewalReminders.sourceCaseId });
}
export function activeReminder(now: Date) {
  return gt(renewalReminders.expiresAt, now.toISOString());
}
export async function purgeRenewalReminders(db: Database, now: Date) {
  // Also hides expired sources at query time, independently of scheduler delay.
  return db.delete(renewalReminders).where(lte(renewalReminders.expiresAt, now.toISOString()));
}
export function reminderOwner(row: ReminderRow): RenewalOwner {
  return {
    id: row.sourceCaseId,
    organizationId: row.organizationId,
    familyId: row.familyId,
    reference: row.reference,
  };
}
