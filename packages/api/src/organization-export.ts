import { consumeMfaCode, mfaCipher, recordMfaFailure } from "./mfa";
import { createHmac } from "node:crypto";
import { eq, getTableColumns, sql } from "drizzle-orm";
import {
  organizations,
  offices,
  operators,
  settings,
  quickReplies,
  prefillDecisions,
  cases,
  documents,
  messages,
  checklistReviews,
  events,
  consumeRateLimit,
  strongSecret,
  type Database,
} from "@avanti/db";
import { OrganizationExportRequest } from "@avanti/contracts";
import { verifyPassword } from "./security";
import { AdminCommandFailure } from "./admin-bootstrap";
import { recordActivity } from "./audit-log";

export async function exportOrganization(
  db: Database,
  raw: unknown,
  now: Date,
  rateLimitSecret: string,
) {
  const parsed = OrganizationExportRequest.safeParse(raw);
  if (!parsed.success)
    throw new AdminCommandFailure("Dati di accesso o organizzazione non validi.");
  if (!strongSecret(rateLimitSecret))
    throw new AdminCommandFailure(
      "RATE_LIMIT_SECRET forte obbligatorio per limitare i tentativi CLI.",
    );
  const input = parsed.data;
  const key = createHmac("sha256", rateLimitSecret).update(input.login.email).digest("hex");
  const limit = await consumeRateLimit(db, `cli-export:${key}`, now, 10, 60);
  if (!limit.allowed) {
    const [account] = await db
      .select()
      .from(operators)
      .where(eq(operators.email, input.login.email));
    await recordActivity(
      db,
      account?.organizationId ?? null,
      null,
      "auth.login_failed",
      now,
      account?.id ?? null,
      { cli: true, rateLimited: true },
    );
    throw new AdminCommandFailure("Troppi tentativi CLI. Attendi un minuto e riprova.");
  }
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`);
    const [admin] = await tx
      .select()
      .from(operators)
      .where(eq(operators.email, input.login.email))
      .for("update");
    if (
      !admin ||
      !admin.active ||
      admin.role !== "admin" ||
      admin.mustChangePassword ||
      admin.organizationId !== input.organizationId ||
      !(await verifyPassword(input.login.password, admin.passwordHash))
    ) {
      await recordActivity(
        tx,
        admin?.organizationId ?? null,
        null,
        "auth.login_failed",
        now,
        admin?.id ?? null,
        { cli: true },
      );
      return null;
    }
    const [policy] = await tx
      .select()
      .from(settings)
      .where(eq(settings.organizationId, admin.organizationId));
    if (admin.mfaEnabledAt || policy?.mfaRequired) {
      const patch =
        admin.mfaEnabledAt && input.login.code
          ? await consumeMfaCode(
              admin,
              input.login.code,
              now,
              mfaCipher({
                key: process.env.MFA_ENCRYPTION_KEY,
                production: process.env.NODE_ENV === "production",
              }),
            )
          : null;
      if (!patch) {
        await recordMfaFailure(tx, admin, now);
        return null;
      }
      await tx.update(operators).set(patch).where(eq(operators.id, admin.id));
      if ("mfaRecoveryHashes" in patch)
        await recordActivity(
          tx,
          admin.organizationId,
          admin.id,
          "auth.mfa_recovery_used",
          now,
          null,
          { cli: true },
        );
    }
    await recordActivity(tx, admin.organizationId, admin.id, "auth.login_succeeded", now, null, {
      cli: true,
    });
    const [organization] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, input.organizationId));
    if (!organization) throw new AdminCommandFailure("Accesso negato.");
    const { tokenHash: _tokenHash, ...caseColumns } = getTableColumns(cases);
    const caseRows = await tx
      .select(caseColumns)
      .from(cases)
      .where(eq(cases.organizationId, organization.id))
      .orderBy(cases.createdAt, cases.id);
    const caseFilter = eq(cases.organizationId, organization.id);
    const documentRows = await tx
      .select({
        id: documents.id,
        caseId: documents.caseId,
        fileName: documents.fileName,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        sha256: documents.sha256,
        pages: documents.pages,
        uploadedAt: documents.uploadedAt,
        checklistItemId: documents.checklistItemId,
        memberId: documents.memberId,
        status: documents.status,
        analysis: documents.analysis,
      })
      .from(documents)
      .innerJoin(cases, eq(documents.caseId, cases.id))
      .where(caseFilter)
      .orderBy(documents.uploadedAt, documents.id);
    const messageRows = await tx
      .select(getTableColumns(messages))
      .from(messages)
      .innerJoin(cases, eq(messages.caseId, cases.id))
      .where(caseFilter)
      .orderBy(messages.createdAt, messages.id);
    const reviews = await tx
      .select(getTableColumns(checklistReviews))
      .from(checklistReviews)
      .innerJoin(cases, eq(checklistReviews.caseId, cases.id))
      .where(caseFilter)
      .orderBy(checklistReviews.caseId, checklistReviews.itemId);
    await tx.insert(events).values({
      id: crypto.randomUUID(),
      organizationId: organization.id,
      actor: "operator",
      actorId: admin.id,
      type: "organization.exported",
      at: now.toISOString(),
      metadata: { cases: caseRows.length, documents: documentRows.length },
    });
    return {
      format: "avanti.organization",
      prefillDecisions: await tx
        .select(getTableColumns(prefillDecisions))
        .from(prefillDecisions)
        .innerJoin(cases, eq(prefillDecisions.caseId, cases.id))
        .where(caseFilter),
      version: 1,
      exportedAt: now.toISOString(),
      organization,
      settings:
        (await tx.select().from(settings).where(eq(settings.organizationId, organization.id)))[0] ??
        null,
      quickReplies: await tx
        .select()
        .from(quickReplies)
        .where(eq(quickReplies.organizationId, organization.id))
        .orderBy(quickReplies.position),
      offices: await tx
        .select()
        .from(offices)
        .where(eq(offices.organizationId, organization.id))
        .orderBy(offices.id),
      operators: await tx
        .select({
          id: operators.id,
          name: operators.name,
          email: operators.email,
          role: operators.role,
          active: operators.active,
          createdAt: operators.createdAt,
        })
        .from(operators)
        .where(eq(operators.organizationId, organization.id))
        .orderBy(operators.id),
      cases: caseRows,
      documents: documentRows,
      messages: messageRows,
      checklistReviews: reviews,
      events: await tx
        .select()
        .from(events)
        .where(eq(events.organizationId, organization.id))
        .orderBy(events.at, events.id),
    };
  });
  if (!result)
    throw new AdminCommandFailure(
      "Accesso negato. Serve un admin attivo del CAF con password definitiva.",
    );
  return result;
}
