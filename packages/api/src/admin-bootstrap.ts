import { temporaryPasswordExpiry } from "./temporary-password";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { organizations, offices, operators, settings, events, type Database } from "@avanti/db";
import { BootstrapOrganizationRequest } from "@avanti/contracts";
import { hashPassword } from "./security";

export class AdminCommandFailure extends Error {}

export async function bootstrapOrganization(db: Database, raw: unknown, now: Date) {
  const result = BootstrapOrganizationRequest.safeParse(raw);
  if (!result.success)
    throw new AdminCommandFailure("Dati non validi o conferma assente. Nessuna modifica eseguita.");
  const input = result.data;
  return db.transaction(async (tx) => {
    // Block competing bootstrap and ordinary admin creation across all database connections.
    await tx.execute(sql`lock table operators, organizations in share row exclusive mode`);
    const existing = await tx
      .select({ id: operators.id })
      .from(operators)
      .where(sql`${operators.role} = 'admin'`)
      .limit(1);
    if (existing.length)
      throw new AdminCommandFailure(
        "Bootstrap rifiutato: esiste già un amministratore. Nessuna credenziale rigenerata.",
      );
    if ((await tx.select({ id: organizations.id }).from(organizations).limit(1)).length)
      throw new AdminCommandFailure(
        "Bootstrap rifiutato: database non vuoto. Verifica il provisioning esistente.",
      );
    const organizationId = crypto.randomUUID();
    const officeId = crypto.randomUUID();
    const adminId = crypto.randomUUID();
    const temporaryPassword = randomBytes(24).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);
    await tx.insert(organizations).values({ id: organizationId, ...input.organization });
    await tx.insert(offices).values({ id: officeId, organizationId, ...input.office });
    await tx.insert(settings).values({ organizationId });
    await tx.insert(operators).values({
      id: adminId,
      organizationId,
      ...input.admin,
      passwordHash,
      role: "admin",
      active: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: temporaryPasswordExpiry(now),
      createdAt: now.toISOString(),
    });
    await tx.insert(events).values({
      id: crypto.randomUUID(),
      organizationId,
      actor: "system",
      type: "organization.bootstrapped",
      at: now.toISOString(),
    });
    return { organizationId, officeId, adminId, temporaryPassword };
  });
}
